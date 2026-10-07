import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  envFilePathFor,
  isDiscordWebhookUrl,
  loadConfig,
  readEnvFile,
  saveConfig,
  updateEnvFile,
  type DevShareConfig,
} from '../src/index.js';

let dir: string;

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'devshare-config-writing-'));
});

afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

describe('saveConfig', () => {
  const config: DevShareConfig = {
    defaultDestination: 'general',
    destinations: [
      { name: 'general', type: 'discord', settings: { webhookEnv: 'DEVSHARE_GENERAL_WEBHOOK' } },
      { name: 'backend', type: 'discord', settings: { webhookEnv: 'DEVSHARE_BACKEND_WEBHOOK' } },
    ],
  };

  it('writes a config that loads back unchanged, creating the folder', async () => {
    const path = join(dir, 'DevShare', 'config.json');

    await saveConfig(path, config);

    await expect(loadConfig(path)).resolves.toEqual(config);
  });

  it('writes the documented format, with settings next to name and type', async () => {
    const path = join(dir, 'config.json');

    await saveConfig(path, config);

    expect(JSON.parse(await readFile(path, 'utf8'))).toEqual({
      defaultDestination: 'general',
      destinations: [
        { name: 'general', type: 'discord', webhookEnv: 'DEVSHARE_GENERAL_WEBHOOK' },
        { name: 'backend', type: 'discord', webhookEnv: 'DEVSHARE_BACKEND_WEBHOOK' },
      ],
    });
  });

  it('omits the default destination when there is none', async () => {
    const path = join(dir, 'config.json');
    const { destinations } = config;

    await saveConfig(path, { destinations });

    expect(JSON.parse(await readFile(path, 'utf8'))).not.toHaveProperty('defaultDestination');
  });

  it('refuses to write an invalid config and leaves the existing file alone', async () => {
    const path = join(dir, 'config.json');
    await saveConfig(path, config);

    await expect(saveConfig(path, { destinations: [] })).rejects.toMatchObject({
      code: 'INVALID_CONFIG',
    });
    await expect(loadConfig(path)).resolves.toEqual(config);
  });
});

describe('updateEnvFile', () => {
  const url = 'https://discord.com/api/webhooks/123/abc-DEF_456';

  it('creates the file when it does not exist', async () => {
    const path = join(dir, '.env');

    await updateEnvFile(path, { DEVSHARE_GENERAL_WEBHOOK: url });

    await expect(readFile(path, 'utf8')).resolves.toBe(`DEVSHARE_GENERAL_WEBHOOK=${url}\n`);
  });

  it('replaces a value in place and keeps comments and other variables', async () => {
    const path = join(dir, '.env');
    await writeFile(
      path,
      '# My webhooks\r\nDEVSHARE_GENERAL_WEBHOOK=old\r\n\r\nOTHER=keep # note\r\n',
    );

    await updateEnvFile(path, { DEVSHARE_GENERAL_WEBHOOK: url });

    await expect(readFile(path, 'utf8')).resolves.toBe(
      `# My webhooks\nDEVSHARE_GENERAL_WEBHOOK=${url}\n\nOTHER=keep # note\n`,
    );
  });

  it('appends new variables after the existing content', async () => {
    const path = join(dir, '.env');
    await writeFile(path, 'OTHER=keep\n\n');

    await updateEnvFile(path, { DEVSHARE_BACKEND_WEBHOOK: url });

    await expect(readFile(path, 'utf8')).resolves.toBe(
      `OTHER=keep\nDEVSHARE_BACKEND_WEBHOOK=${url}\n`,
    );
  });

  it('removes variables, including repeated definitions', async () => {
    const path = join(dir, '.env');
    await writeFile(path, 'A=1\nexport GONE=2\nB=3\nGONE = 4\n');

    await updateEnvFile(path, { GONE: undefined });

    await expect(readFile(path, 'utf8')).resolves.toBe('A=1\nB=3\n');
  });

  it('writes values that read back exactly', async () => {
    const path = join(dir, '.env');

    await updateEnvFile(path, { DEVSHARE_GENERAL_WEBHOOK: url, OTHER: 'x=y' });

    await expect(readEnvFile(path)).resolves.toEqual({
      DEVSHARE_GENERAL_WEBHOOK: url,
      OTHER: 'x=y',
    });
  });

  it.each([
    ['whitespace', 'a b'],
    ['a newline', 'a\nINJECTED=1'],
    ['a quote', 'a"b'],
    ['a comment marker', 'a#b'],
    ['an empty value', ''],
  ])('refuses a value with %s without revealing it', async (_case, value) => {
    const path = join(dir, '.env');

    const error: unknown = await updateEnvFile(path, { SECRET: value }).catch((e: unknown) => e);

    expect(error).toMatchObject({
      code: 'INVALID_CONFIG',
      message: 'The value for SECRET cannot be saved.',
    });
  });

  it('refuses invalid variable names', async () => {
    await expect(updateEnvFile(join(dir, '.env'), { 'NOT VALID': 'x' })).rejects.toMatchObject({
      code: 'INVALID_CONFIG',
    });
  });
});

describe('envFilePathFor', () => {
  it('is the .env file next to the config file', () => {
    expect(envFilePathFor(join(dir, 'config.json'))).toBe(join(dir, '.env'));
  });
});

describe('isDiscordWebhookUrl', () => {
  it('accepts HTTPS Discord webhook URLs and rejects anything else', () => {
    expect(isDiscordWebhookUrl('https://discord.com/api/webhooks/123/abc')).toBe(true);
    expect(isDiscordWebhookUrl('http://discord.com/api/webhooks/123/abc')).toBe(false);
    expect(isDiscordWebhookUrl('https://example.com/api/webhooks/123/abc')).toBe(false);
    expect(isDiscordWebhookUrl('not a url')).toBe(false);
  });
});
