import { homedir } from 'node:os';
import { posix, win32 } from 'node:path';

/** Environment variable that overrides the config file location. */
export const CONFIG_PATH_ENV = 'DEVSHARE_CONFIG';

export interface ConfigPathOptions {
  readonly env?: NodeJS.ProcessEnv;
  readonly platform?: NodeJS.Platform;
  readonly homeDir?: string;
}

/**
 * Location of the user's config file, outside any repository:
 * `%APPDATA%\DevShare\config.json` on Windows, `$XDG_CONFIG_HOME/devshare/config.json`
 * elsewhere. `DEVSHARE_CONFIG` overrides both.
 */
export function resolveConfigPath(options: ConfigPathOptions = {}): string {
  const { env = process.env, platform = process.platform, homeDir = homedir() } = options;

  const override = nonEmpty(env[CONFIG_PATH_ENV]);
  if (override !== undefined) {
    return override;
  }
  if (platform === 'win32') {
    const appData = nonEmpty(env.APPDATA) ?? win32.join(homeDir, 'AppData', 'Roaming');
    return win32.join(appData, 'DevShare', 'config.json');
  }
  const configHome = nonEmpty(env.XDG_CONFIG_HOME) ?? posix.join(homeDir, '.config');
  return posix.join(configHome, 'devshare', 'config.json');
}

function nonEmpty(value: string | undefined): string | undefined {
  return value?.trim() ? value : undefined;
}
