import { dirname, join } from 'node:path';

import { loadConfig } from './config.js';
import { resolveConfigPath } from './config-path.js';
import { readEnvFile } from './env-file.js';
import { SharingService } from './sharing-service.js';
import type { Environment, TransportFactory } from './transport.js';
import { createBuiltInTransports } from './transports/index.js';

/** Secrets file read from the same folder as the config file. */
export const ENV_FILE_NAME = '.env';

export interface LocalSetupOptions {
  /** Process environment; defaults to `process.env`. Its values override the `.env` file. */
  readonly env?: Environment;
  /** Config file location; defaults to `resolveConfigPath()`. */
  readonly configPath?: string;
  /** Available transports; defaults to the built-in ones. */
  readonly transports?: readonly TransportFactory[];
}

/**
 * Creates a sharing service from the user's local setup: the config file plus secrets from
 * the `.env` file next to it and from environment variables.
 */
export async function loadLocalSharingService(
  options: LocalSetupOptions = {},
): Promise<SharingService> {
  const env = options.env ?? process.env;
  const configPath = options.configPath ?? resolveConfigPath({ env });
  const [config, fileEnv] = await Promise.all([
    loadConfig(configPath),
    readEnvFile(join(dirname(configPath), ENV_FILE_NAME)),
  ]);
  return new SharingService({
    config,
    env: { ...fileEnv, ...env },
    transports: options.transports ?? createBuiltInTransports(),
  });
}
