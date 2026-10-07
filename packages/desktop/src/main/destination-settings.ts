import {
  DevShareError,
  DISCORD_TRANSPORT_TYPE,
  envFilePathFor,
  isDiscordWebhookUrl,
  loadConfig,
  readEnvFile,
  saveConfig,
  updateEnvFile,
  type DestinationConfig,
  type DevShareConfig,
  type Environment,
} from '@devshare/core';

import type {
  DestinationSettingsItem,
  DestinationSettingsView,
  SaveDestinationRequest,
  WebhookStatus,
} from '../shared/ipc.js';
import { invalidRequest } from './errors.js';

/** Destination setting naming the environment variable that holds a Discord webhook URL. */
const WEBHOOK_SETTING = 'webhookEnv';
const MAX_NAME_LENGTH = 50;
// eslint-disable-next-line no-control-regex -- matching control characters is the point.
const CONTROL_CHARACTERS = /[\u0000-\u001f\u007f]/;

export interface DestinationSettingsOptions {
  readonly configPath: string;
  /** Process environment; its variables take precedence over the `.env` file. */
  readonly env: Environment;
}

/**
 * Adds, changes, and removes destinations by editing `config.json` and the `.env` file next to
 * it. Every change re-reads both files first, so edits made by hand in between are kept.
 * Webhook URLs only flow in: they are written to `.env` and never returned.
 */
export class DestinationSettings {
  readonly #configPath: string;
  readonly #envPath: string;
  readonly #env: Environment;

  constructor(options: DestinationSettingsOptions) {
    this.#configPath = options.configPath;
    this.#envPath = envFilePathFor(options.configPath);
    this.#env = options.env;
  }

  async view(): Promise<DestinationSettingsView> {
    const [config, fileEnv] = await Promise.all([this.#load(), readEnvFile(this.#envPath)]);
    return {
      configPath: this.#configPath,
      destinations: config.destinations.map((destination) => this.#item(destination, fileEnv)),
      defaultDestination: config.defaultDestination,
    };
  }

  async save(input: unknown): Promise<DestinationSettingsView> {
    const request = parseSaveRequest(input);
    const [config, fileEnv] = await Promise.all([this.#load(), readEnvFile(this.#envPath)]);

    const existing =
      request.originalName === undefined ? undefined : find(config, request.originalName);
    if (request.originalName !== undefined && !existing) {
      throw new DevShareError(
        'DESTINATION_NOT_FOUND',
        `Destination "${request.originalName}" no longer exists.`,
      );
    }
    const others = config.destinations.filter((destination) => destination !== existing);
    if (find({ destinations: others }, request.name)) {
      throw new DevShareError(
        'INVALID_DESTINATION',
        `There is already a destination named "${request.name}".`,
      );
    }

    const type = existing?.type ?? DISCORD_TRANSPORT_TYPE;
    const { webhookUrl } = request;
    if (type !== DISCORD_TRANSPORT_TYPE) {
      if (webhookUrl !== undefined) {
        throw invalidRequest(`Destination "${request.name}" does not use a webhook URL.`);
      }
    } else if (webhookUrl === undefined) {
      if (!existing) {
        throw new DevShareError('INVALID_DESTINATION', 'Enter the webhook URL for the channel.');
      }
    } else if (!isDiscordWebhookUrl(webhookUrl)) {
      // The URL is deliberately not repeated in the message: it may be a secret.
      throw new DevShareError(
        'INVALID_DESTINATION',
        'That is not a Discord webhook URL. In Discord, use Copy Webhook URL in the channel’s Integrations settings.',
      );
    }

    let settings = existing?.settings ?? {};
    if (type === DISCORD_TRANSPORT_TYPE) {
      let variable = webhookVariable(existing);
      // A destination gets its own variable when it has none, or when it shares one with
      // another destination and gets a new URL (which would otherwise change both).
      if (
        variable === undefined ||
        (webhookUrl !== undefined && others.some((other) => webhookVariable(other) === variable))
      ) {
        variable = this.#newVariableName(request.name, config, fileEnv);
      }
      settings = { ...settings, [WEBHOOK_SETTING]: variable };
      if (webhookUrl !== undefined) {
        // Saved before the config, so a failure never leaves a destination without its URL.
        await updateEnvFile(this.#envPath, { [variable]: webhookUrl });
      }
    }

    const updated: DestinationConfig = { name: request.name, type, settings };
    const destinations = existing
      ? config.destinations.map((destination) => (destination === existing ? updated : destination))
      : [...config.destinations, updated];
    const wasDefault =
      existing !== undefined &&
      config.defaultDestination !== undefined &&
      find(config, config.defaultDestination) === existing;
    await saveConfig(this.#configPath, {
      ...(config.defaultDestination !== undefined && {
        defaultDestination: wasDefault ? updated.name : config.defaultDestination,
      }),
      destinations,
    });
    return this.view();
  }

  async remove(input: unknown): Promise<DestinationSettingsView> {
    const name = parseName(input);
    const config = await this.#load();
    const removed = find(config, name);
    if (!removed) {
      throw new DevShareError('DESTINATION_NOT_FOUND', `Destination "${name}" no longer exists.`);
    }
    const destinations = config.destinations.filter((destination) => destination !== removed);
    if (destinations.length === 0) {
      throw new DevShareError(
        'INVALID_DESTINATION',
        'DevShare needs at least one destination. Add another one before removing this one.',
      );
    }

    const keepDefault =
      config.defaultDestination !== undefined &&
      find(config, config.defaultDestination) !== removed;
    await saveConfig(this.#configPath, {
      ...(keepDefault && { defaultDestination: config.defaultDestination }),
      destinations,
    });
    // Removed after the config is saved, so a failure only leaves an unused secret behind.
    const variable = webhookVariable(removed);
    if (variable !== undefined && !destinations.some((d) => webhookVariable(d) === variable)) {
      await updateEnvFile(this.#envPath, { [variable]: undefined });
    }
    return this.view();
  }

  async setDefault(input: unknown): Promise<DestinationSettingsView> {
    const name = parseName(input);
    const config = await this.#load();
    const destination = find(config, name);
    if (!destination) {
      throw new DevShareError('DESTINATION_NOT_FOUND', `Destination "${name}" no longer exists.`);
    }
    await saveConfig(this.#configPath, { ...config, defaultDestination: destination.name });
    return this.view();
  }

  /** The current config, or none yet. A config that cannot be read or parsed is an error. */
  async #load(): Promise<DevShareConfig> {
    try {
      return await loadConfig(this.#configPath);
    } catch (error) {
      if (error instanceof DevShareError && error.code === 'CONFIG_NOT_FOUND') {
        return { destinations: [] };
      }
      throw error;
    }
  }

  #item(destination: DestinationConfig, fileEnv: Environment): DestinationSettingsItem {
    const variable = webhookVariable(destination);
    let webhookStatus: WebhookStatus;
    if (destination.type.toLowerCase() !== DISCORD_TRANSPORT_TYPE) {
      webhookStatus = 'not-applicable';
    } else if (variable !== undefined && this.#env[variable]?.trim()) {
      webhookStatus = 'environment';
    } else if (variable !== undefined && fileEnv[variable]?.trim()) {
      webhookStatus = 'saved';
    } else {
      webhookStatus = 'missing';
    }
    return {
      name: destination.name,
      type: destination.type,
      webhookStatus,
      webhookVariable: variable,
    };
  }

  /**
   * A variable name derived from the destination name, such as `DEVSHARE_BACKEND_WEBHOOK`, that
   * is not used yet by a destination, the `.env` file, or the environment.
   */
  #newVariableName(name: string, config: DevShareConfig, fileEnv: Environment): string {
    const slug = name
      .toUpperCase()
      .replace(/[^A-Z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '');
    const base = `DEVSHARE_${slug || 'DESTINATION'}_WEBHOOK`;
    const taken = (candidate: string) =>
      config.destinations.some((destination) => webhookVariable(destination) === candidate) ||
      candidate in fileEnv ||
      candidate in this.#env;
    let candidate = base;
    for (let suffix = 2; taken(candidate); suffix++) {
      candidate = `${base}_${String(suffix)}`;
    }
    return candidate;
  }
}

function webhookVariable(destination: DestinationConfig | undefined): string | undefined {
  const variable = destination?.settings[WEBHOOK_SETTING];
  return typeof variable === 'string' && variable.trim() !== '' ? variable : undefined;
}

function find(config: Pick<DevShareConfig, 'destinations'>, name: string) {
  const wanted = name.trim().toLowerCase();
  return config.destinations.find((destination) => destination.name.toLowerCase() === wanted);
}

function parseName(input: unknown): string {
  if (typeof input !== 'string' || input.trim() === '') {
    throw invalidRequest();
  }
  return input.trim();
}

function parseSaveRequest(input: unknown): SaveDestinationRequest {
  if (typeof input !== 'object' || input === null || Array.isArray(input)) {
    throw invalidRequest();
  }
  const { originalName, name, webhookUrl } = input as Partial<
    Record<keyof SaveDestinationRequest, unknown>
  >;
  if (
    (originalName !== undefined && typeof originalName !== 'string') ||
    typeof name !== 'string' ||
    (webhookUrl !== undefined && typeof webhookUrl !== 'string')
  ) {
    throw invalidRequest();
  }
  const trimmedName = name.trim();
  if (trimmedName === '') {
    throw new DevShareError('INVALID_DESTINATION', 'Enter a name for the destination.');
  }
  if (trimmedName.length > MAX_NAME_LENGTH || CONTROL_CHARACTERS.test(trimmedName)) {
    throw new DevShareError(
      'INVALID_DESTINATION',
      `Destination names can be up to ${String(MAX_NAME_LENGTH)} characters, on one line.`,
    );
  }
  const trimmedUrl = webhookUrl?.trim();
  return {
    ...(originalName !== undefined && { originalName }),
    name: trimmedName,
    ...(trimmedUrl && { webhookUrl: trimmedUrl }),
  };
}
