import { describe, expect, it } from 'vitest';

import { resolveConfigPath } from '../src/index.js';

describe('resolveConfigPath', () => {
  it('uses %APPDATA% on Windows', () => {
    expect(
      resolveConfigPath({
        platform: 'win32',
        env: { APPDATA: 'C:\\Users\\dev\\AppData\\Roaming' },
        homeDir: 'C:\\Users\\dev',
      }),
    ).toBe('C:\\Users\\dev\\AppData\\Roaming\\DevShare\\config.json');
  });

  it('falls back to the roaming profile when %APPDATA% is not set on Windows', () => {
    expect(resolveConfigPath({ platform: 'win32', env: {}, homeDir: 'C:\\Users\\dev' })).toBe(
      'C:\\Users\\dev\\AppData\\Roaming\\DevShare\\config.json',
    );
  });

  it('uses XDG_CONFIG_HOME on other platforms', () => {
    expect(
      resolveConfigPath({
        platform: 'linux',
        env: { XDG_CONFIG_HOME: '/home/dev/.xdg' },
        homeDir: '/home/dev',
      }),
    ).toBe('/home/dev/.xdg/devshare/config.json');
  });

  it('falls back to ~/.config on other platforms', () => {
    expect(resolveConfigPath({ platform: 'linux', env: {}, homeDir: '/home/dev' })).toBe(
      '/home/dev/.config/devshare/config.json',
    );
  });

  it('lets DEVSHARE_CONFIG override the platform default', () => {
    expect(
      resolveConfigPath({
        platform: 'win32',
        env: { DEVSHARE_CONFIG: 'D:\\configs\\devshare.json', APPDATA: 'C:\\AppData' },
        homeDir: 'C:\\Users\\dev',
      }),
    ).toBe('D:\\configs\\devshare.json');
  });

  it('ignores an empty DEVSHARE_CONFIG', () => {
    expect(
      resolveConfigPath({ platform: 'linux', env: { DEVSHARE_CONFIG: ' ' }, homeDir: '/home/dev' }),
    ).toBe('/home/dev/.config/devshare/config.json');
  });
});
