import type { DestinationConfig } from './config.js';
import { DevShareError } from './errors.js';
import type { Environment } from './transport.js';

export interface Secret {
  /** Name of the environment variable the secret was read from; safe to show users. */
  readonly variable: string;
  /** The secret itself. Never log it or include it in error messages. */
  readonly value: string;
}

/**
 * Reads a destination secret. Configs never contain secrets directly: the setting names an
 * environment variable (e.g. `"webhookEnv": "DEVSHARE_BACKEND_WEBHOOK"`) holding the value.
 */
export function readSecretSetting(
  destination: DestinationConfig,
  setting: string,
  env: Environment,
): Secret {
  const variable = destination.settings[setting];
  if (typeof variable !== 'string' || variable.trim() === '') {
    throw new DevShareError(
      'INVALID_DESTINATION',
      `Destination "${destination.name}": "${setting}" must name an environment variable.`,
    );
  }

  const value = env[variable]?.trim();
  if (!value) {
    throw new DevShareError(
      'MISSING_SECRET',
      `Destination "${destination.name}": environment variable ${variable} is not set.`,
    );
  }
  return { variable, value };
}
