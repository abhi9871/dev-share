import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { loadConfig, readEnvFile } from '@devshare/core';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { DestinationSettings } from '../src/main/destination-settings.js';

const URL_A = 'https://discord.com/api/webhooks/111/aaa';
const URL_B = 'https://discord.com/api/webhooks/222/bbb';

let dir: string;
let configPath: string;
let envPath: string;

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'devshare-destinations-'));
  configPath = join(dir, 'DevShare', 'config.json');
  envPath = join(dir, 'DevShare', '.env');
});

afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

function settings(env: Record<string, string> = {}) {
  return new DestinationSettings({ configPath, env });
}

async function mkDevShareDir(): Promise<string> {
  const path = join(dir, 'DevShare');
  await mkdir(path, { recursive: true });
  return path;
}

async function writeConfig(config: unknown): Promise<void> {
  await mkDevShareDir();
  await writeFile(configPath, JSON.stringify(config));
}

describe('DestinationSettings.view', () => {
  it('shows no destinations when there is no config file yet', async () => {
    await expect(settings().view()).resolves.toEqual({
      configPath,
      destinations: [],
      defaultDestination: undefined,
    });
  });

  it('reports where each webhook URL comes from, never the URL itself', async () => {
    await writeConfig({
      defaultDestination: 'general',
      destinations: [
        { name: 'general', type: 'discord', webhookEnv: 'DEVSHARE_GENERAL_WEBHOOK' },
        { name: 'backend', type: 'discord', webhookEnv: 'DEVSHARE_BACKEND_WEBHOOK' },
        { name: 'bugs', type: 'discord', webhookEnv: 'DEVSHARE_BUGS_WEBHOOK' },
        { name: 'custom', type: 'other' },
      ],
    });
    await writeFile(envPath, `DEVSHARE_GENERAL_WEBHOOK=${URL_A}\n`);

    const view = await settings({ DEVSHARE_BACKEND_WEBHOOK: URL_B }).view();

    expect(view.defaultDestination).toBe('general');
    expect(view.destinations).toEqual([
      {
        name: 'general',
        type: 'discord',
        webhookStatus: 'saved',
        webhookVariable: 'DEVSHARE_GENERAL_WEBHOOK',
      },
      {
        name: 'backend',
        type: 'discord',
        webhookStatus: 'environment',
        webhookVariable: 'DEVSHARE_BACKEND_WEBHOOK',
      },
      {
        name: 'bugs',
        type: 'discord',
        webhookStatus: 'missing',
        webhookVariable: 'DEVSHARE_BUGS_WEBHOOK',
      },
      {
        name: 'custom',
        type: 'other',
        webhookStatus: 'not-applicable',
        webhookVariable: undefined,
      },
    ]);
    expect(JSON.stringify(view)).not.toContain('discord.com/api/webhooks');
  });

  it('reports a broken config instead of hiding it', async () => {
    await writeConfig({ destinations: 'nope' });

    await expect(settings().view()).rejects.toMatchObject({ code: 'INVALID_CONFIG' });
  });
});

describe('DestinationSettings.save', () => {
  it('creates the config and .env for the first destination', async () => {
    const view = await settings().save({ name: '  Backend API ', webhookUrl: ` ${URL_A} ` });

    expect(view.destinations).toEqual([
      {
        name: 'Backend API',
        type: 'discord',
        webhookStatus: 'saved',
        webhookVariable: 'DEVSHARE_BACKEND_API_WEBHOOK',
      },
    ]);
    await expect(loadConfig(configPath)).resolves.toEqual({
      destinations: [
        {
          name: 'Backend API',
          type: 'discord',
          settings: { webhookEnv: 'DEVSHARE_BACKEND_API_WEBHOOK' },
        },
      ],
    });
    await expect(readEnvFile(envPath)).resolves.toEqual({ DEVSHARE_BACKEND_API_WEBHOOK: URL_A });
    expect(await readFile(configPath, 'utf8')).not.toContain('discord.com');
  });

  it('adds destinations next to existing ones and keeps other .env lines', async () => {
    await settings().save({ name: 'general', webhookUrl: URL_A });
    await writeFile(envPath, `# mine\nDEVSHARE_GENERAL_WEBHOOK=${URL_A}\nOTHER=1\n`);

    await settings().save({ name: 'backend', webhookUrl: URL_B });

    expect((await loadConfig(configPath)).destinations.map((d) => d.name)).toEqual([
      'general',
      'backend',
    ]);
    await expect(readFile(envPath, 'utf8')).resolves.toBe(
      `# mine\nDEVSHARE_GENERAL_WEBHOOK=${URL_A}\nOTHER=1\nDEVSHARE_BACKEND_WEBHOOK=${URL_B}\n`,
    );
  });

  it('picks a variable name that is not used yet', async () => {
    await writeFile(join(await mkDevShareDir(), '.env'), 'DEVSHARE_BUGS_WEBHOOK=someone-elses\n');

    const view = await settings({ DEVSHARE_BUGS_WEBHOOK_2: 'x' }).save({
      name: 'bugs',
      webhookUrl: URL_A,
    });

    expect(view.destinations[0]?.webhookVariable).toBe('DEVSHARE_BUGS_WEBHOOK_3');
    expect((await readEnvFile(envPath)).DEVSHARE_BUGS_WEBHOOK).toBe('someone-elses');
  });

  it('renames a destination, keeping its URL and its place as the default', async () => {
    await settings().save({ name: 'general', webhookUrl: URL_A });
    await settings().save({ name: 'backend', webhookUrl: URL_B });
    await settings().setDefault('general');

    const view = await settings().save({ originalName: 'general', name: 'team' });

    expect(view.defaultDestination).toBe('team');
    expect(view.destinations[0]).toMatchObject({
      name: 'team',
      webhookStatus: 'saved',
      webhookVariable: 'DEVSHARE_GENERAL_WEBHOOK',
    });
    await expect(readEnvFile(envPath)).resolves.toMatchObject({ DEVSHARE_GENERAL_WEBHOOK: URL_A });
  });

  it('replaces the URL of an existing destination', async () => {
    await settings().save({ name: 'general', webhookUrl: URL_A });

    await settings().save({ originalName: 'general', name: 'general', webhookUrl: URL_B });

    await expect(readEnvFile(envPath)).resolves.toEqual({ DEVSHARE_GENERAL_WEBHOOK: URL_B });
  });

  it('gives a destination its own variable before changing a URL it shares', async () => {
    await writeConfig({
      destinations: [
        { name: 'a', type: 'discord', webhookEnv: 'DEVSHARE_SHARED_WEBHOOK' },
        { name: 'b', type: 'discord', webhookEnv: 'DEVSHARE_SHARED_WEBHOOK' },
      ],
    });
    await writeFile(envPath, `DEVSHARE_SHARED_WEBHOOK=${URL_A}\n`);

    const view = await settings().save({ originalName: 'b', name: 'b', webhookUrl: URL_B });

    expect(view.destinations.map((d) => d.webhookVariable)).toEqual([
      'DEVSHARE_SHARED_WEBHOOK',
      'DEVSHARE_B_WEBHOOK',
    ]);
    await expect(readEnvFile(envPath)).resolves.toEqual({
      DEVSHARE_SHARED_WEBHOOK: URL_A,
      DEVSHARE_B_WEBHOOK: URL_B,
    });
  });

  it('keeps settings it does not manage', async () => {
    await writeConfig({
      destinations: [
        { name: 'general', type: 'discord', webhookEnv: 'DEVSHARE_GENERAL_WEBHOOK', extra: 1 },
      ],
    });

    await settings().save({ originalName: 'general', name: 'renamed' });

    expect((await loadConfig(configPath)).destinations[0]?.settings).toEqual({
      webhookEnv: 'DEVSHARE_GENERAL_WEBHOOK',
      extra: 1,
    });
  });

  it('requires a webhook URL for a new destination', async () => {
    await expect(settings().save({ name: 'general' })).rejects.toMatchObject({
      code: 'INVALID_DESTINATION',
      message: 'Enter the webhook URL for the channel.',
    });
  });

  it('refuses URLs that are not Discord webhooks, without repeating them', async () => {
    const secretLooking = 'https://example.com/hooks/secret-token';

    const error: unknown = await settings()
      .save({ name: 'general', webhookUrl: secretLooking })
      .catch((e: unknown) => e);

    expect(error).toMatchObject({ code: 'INVALID_DESTINATION' });
    expect((error as Error).message).not.toContain('secret-token');
  });

  it('refuses a name that is already used, ignoring case', async () => {
    await settings().save({ name: 'General', webhookUrl: URL_A });

    await expect(settings().save({ name: 'general', webhookUrl: URL_B })).rejects.toMatchObject({
      code: 'INVALID_DESTINATION',
      message: 'There is already a destination named "general".',
    });
  });

  it('allows changing only the capitalization of a name', async () => {
    await settings().save({ name: 'general', webhookUrl: URL_A });

    const view = await settings().save({ originalName: 'general', name: 'General' });

    expect(view.destinations.map((d) => d.name)).toEqual(['General']);
  });

  it('reports a destination that was removed in the meantime', async () => {
    await settings().save({ name: 'general', webhookUrl: URL_A });

    await expect(settings().save({ originalName: 'gone', name: 'gone' })).rejects.toMatchObject({
      code: 'DESTINATION_NOT_FOUND',
    });
  });

  it.each([
    ['an empty name', { name: '   ', webhookUrl: URL_A }, 'INVALID_DESTINATION'],
    [
      'a name over 50 characters',
      { name: 'x'.repeat(51), webhookUrl: URL_A },
      'INVALID_DESTINATION',
    ],
    ['a name with a line break', { name: 'a\nb', webhookUrl: URL_A }, 'INVALID_DESTINATION'],
    ['no request', undefined, 'INVALID_REQUEST'],
    ['a non-string name', { name: 1, webhookUrl: URL_A }, 'INVALID_REQUEST'],
    ['a non-string URL', { name: 'a', webhookUrl: 1 }, 'INVALID_REQUEST'],
  ])('rejects %s and writes nothing', async (_case, input, code) => {
    await expect(settings().save(input)).rejects.toMatchObject({ code });
    await expect(readFile(configPath, 'utf8')).rejects.toMatchObject({ code: 'ENOENT' });
  });

  it('does not overwrite a config it cannot parse', async () => {
    await writeConfig({ destinations: 'nope' });

    await expect(settings().save({ name: 'general', webhookUrl: URL_A })).rejects.toMatchObject({
      code: 'INVALID_CONFIG',
    });
    expect(JSON.parse(await readFile(configPath, 'utf8'))).toEqual({ destinations: 'nope' });
  });
});

describe('DestinationSettings.remove', () => {
  it('removes the destination, its default status, and its webhook URL', async () => {
    await settings().save({ name: 'general', webhookUrl: URL_A });
    await settings().save({ name: 'backend', webhookUrl: URL_B });
    await settings().setDefault('backend');

    const view = await settings().remove('backend');

    expect(view.destinations.map((d) => d.name)).toEqual(['general']);
    expect(view.defaultDestination).toBeUndefined();
    await expect(readEnvFile(envPath)).resolves.toEqual({ DEVSHARE_GENERAL_WEBHOOK: URL_A });
  });

  it('keeps a webhook URL that another destination still uses', async () => {
    await writeConfig({
      destinations: [
        { name: 'a', type: 'discord', webhookEnv: 'DEVSHARE_SHARED_WEBHOOK' },
        { name: 'b', type: 'discord', webhookEnv: 'DEVSHARE_SHARED_WEBHOOK' },
      ],
    });
    await writeFile(envPath, `DEVSHARE_SHARED_WEBHOOK=${URL_A}\n`);

    await settings().remove('a');

    await expect(readEnvFile(envPath)).resolves.toEqual({ DEVSHARE_SHARED_WEBHOOK: URL_A });
  });

  it('refuses to remove the last destination', async () => {
    await settings().save({ name: 'general', webhookUrl: URL_A });

    await expect(settings().remove('general')).rejects.toMatchObject({
      code: 'INVALID_DESTINATION',
    });
    expect((await loadConfig(configPath)).destinations).toHaveLength(1);
  });

  it('reports an unknown destination', async () => {
    await settings().save({ name: 'general', webhookUrl: URL_A });

    await expect(settings().remove('nope')).rejects.toMatchObject({
      code: 'DESTINATION_NOT_FOUND',
    });
  });
});

describe('DestinationSettings.setDefault', () => {
  it('makes the named destination the default, using its stored spelling', async () => {
    await settings().save({ name: 'General', webhookUrl: URL_A });
    await settings().save({ name: 'Backend', webhookUrl: URL_B });

    const view = await settings().setDefault('backend');

    expect(view.defaultDestination).toBe('Backend');
  });

  it('rejects input that is not a name', async () => {
    await expect(settings().setDefault(42)).rejects.toMatchObject({ code: 'INVALID_REQUEST' });
  });
});
