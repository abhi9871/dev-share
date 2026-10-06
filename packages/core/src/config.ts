import { readFile } from 'node:fs/promises';

import { DevShareError } from './errors.js';
import { systemErrorCode } from './node-errors.js';
import { stripByteOrderMark } from './text.js';

/** A named place to share to, such as a Discord channel. */
export interface DestinationConfig {
  readonly name: string;
  /** Transport that delivers to this destination, e.g. `discord`. */
  readonly type: string;
  /** Transport-specific settings; the transport for `type` validates them. */
  readonly settings: Readonly<Record<string, unknown>>;
}

export interface DevShareConfig {
  /** Destination used when none is chosen explicitly. */
  readonly defaultDestination?: string;
  readonly destinations: readonly DestinationConfig[];
}

const TOP_LEVEL_KEYS: ReadonlySet<string> = new Set(['defaultDestination', 'destinations']);

/** Reads and validates a JSON config file. */
export async function loadConfig(path: string): Promise<DevShareConfig> {
  const text = await readConfigFile(path);
  let json: unknown;
  try {
    json = JSON.parse(stripByteOrderMark(text));
  } catch (error) {
    throw new DevShareError('INVALID_CONFIG', `Config file "${path}" is not valid JSON.`, {
      cause: error,
    });
  }
  return parseConfig(json, path);
}

/** Validates an already-parsed config. `source` identifies the config in error messages. */
export function parseConfig(value: unknown, source: string): DevShareConfig {
  const invalid = (detail: string) =>
    new DevShareError('INVALID_CONFIG', `Invalid config "${source}": ${detail}`);

  if (!isRecord(value)) {
    throw invalid('expected a JSON object.');
  }
  const unknownKey = Object.keys(value).find((key) => !TOP_LEVEL_KEYS.has(key));
  if (unknownKey !== undefined) {
    throw invalid(`unknown setting "${unknownKey}".`);
  }

  const { destinations, defaultDestination } = value;
  if (!Array.isArray(destinations) || destinations.length === 0) {
    throw invalid('"destinations" must be a non-empty list.');
  }

  const parsed: DestinationConfig[] = [];
  destinations.forEach((entry: unknown, index) => {
    const label = `destinations[${String(index)}]`;
    if (!isRecord(entry)) {
      throw invalid(`${label} must be an object.`);
    }
    const { name, type, ...settings } = entry;
    if (!isNonEmptyString(name)) {
      throw invalid(`${label}.name must be a non-empty string.`);
    }
    if (!isNonEmptyString(type)) {
      throw invalid(`${label}.type must be a non-empty string.`);
    }
    if (findDestination(parsed, name)) {
      throw invalid(`destination names must be unique; "${name}" is used more than once.`);
    }
    parsed.push({ name: name.trim(), type: type.trim(), settings });
  });

  if (defaultDestination === undefined) {
    return { destinations: parsed };
  }
  if (!isNonEmptyString(defaultDestination) || !findDestination(parsed, defaultDestination)) {
    throw invalid('"defaultDestination" must be the name of a configured destination.');
  }
  return { defaultDestination, destinations: parsed };
}

/**
 * Picks the destination to share to: the named one if given, otherwise the default (see
 * `defaultDestination`). Names are matched case-insensitively.
 */
export function resolveDestination(config: DevShareConfig, name?: string): DestinationConfig {
  const wanted = name ?? defaultDestination(config)?.name;
  if (wanted === undefined) {
    throw new DevShareError(
      'DESTINATION_REQUIRED',
      `Choose a destination (${destinationNames(config)}) or set "defaultDestination" in your config.`,
    );
  }

  const destination = findDestination(config.destinations, wanted);
  if (!destination) {
    throw new DevShareError(
      'DESTINATION_NOT_FOUND',
      `Unknown destination "${wanted}". Available: ${destinationNames(config)}.`,
    );
  }
  return destination;
}

/** The destination used when none is named: the configured default, or the only destination. */
export function defaultDestination(config: DevShareConfig): DestinationConfig | undefined {
  if (config.defaultDestination !== undefined) {
    return findDestination(config.destinations, config.defaultDestination);
  }
  const [onlyDestination, ...others] = config.destinations;
  return others.length === 0 ? onlyDestination : undefined;
}

async function readConfigFile(path: string): Promise<string> {
  try {
    return await readFile(path, 'utf8');
  } catch (error) {
    if (systemErrorCode(error) === 'ENOENT') {
      throw new DevShareError('CONFIG_NOT_FOUND', `Config file not found: "${path}".`, {
        cause: error,
      });
    }
    throw new DevShareError('CONFIG_NOT_READABLE', `Could not read config file "${path}".`, {
      cause: error,
    });
  }
}

function findDestination(
  destinations: readonly DestinationConfig[],
  name: string,
): DestinationConfig | undefined {
  const wanted = name.trim().toLowerCase();
  return destinations.find((destination) => destination.name.toLowerCase() === wanted);
}

function destinationNames(config: DevShareConfig): string {
  return config.destinations.map((destination) => destination.name).join(', ');
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim() !== '';
}
