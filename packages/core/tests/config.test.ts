import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { parseConfig } from '../src/config.js';
import { loadConfig, resolveDestination, type DevShareConfig } from '../src/index.js';

const SOURCE = 'test-config.json';

const general = {
  name: 'General',
  type: 'discord',
  settings: { webhookEnv: 'DEVSHARE_GENERAL_WEBHOOK' },
};
const backend = {
  name: 'Backend',
  type: 'discord',
  settings: { webhookEnv: 'DEVSHARE_BACKEND_WEBHOOK' },
};

function destinationEntry(destination: typeof general) {
  return { name: destination.name, type: destination.type, ...destination.settings };
}

describe('parseConfig', () => {
  it('parses destinations and keeps transport-specific settings', () => {
    const config = parseConfig(
      { defaultDestination: 'General', destinations: [general, backend].map(destinationEntry) },
      SOURCE,
    );

    expect(config).toEqual({ defaultDestination: 'General', destinations: [general, backend] });
  });

  it('allows the default destination to be omitted', () => {
    expect(parseConfig({ destinations: [destinationEntry(general)] }, SOURCE)).toEqual({
      destinations: [general],
    });
  });

  it.each([
    ['a non-object', 'not a config'],
    ['an unknown top-level setting', { destination: [] }],
    ['missing destinations', {}],
    ['an empty destination list', { destinations: [] }],
    ['a non-object destination', { destinations: ['General'] }],
    ['a destination without a name', { destinations: [{ type: 'discord' }] }],
    ['a destination with a blank name', { destinations: [{ name: ' ', type: 'discord' }] }],
    ['a destination without a type', { destinations: [{ name: 'General' }] }],
    [
      'duplicate names, ignoring case',
      {
        destinations: [
          destinationEntry(general),
          { ...destinationEntry(general), name: 'general' },
        ],
      },
    ],
    [
      'a default that is not configured',
      { defaultDestination: 'Bugs', destinations: [destinationEntry(general)] },
    ],
  ])('rejects %s', (_label, value) => {
    expect(() => parseConfig(value, SOURCE)).toThrow(
      expect.objectContaining({ code: 'INVALID_CONFIG' }),
    );
  });

  it('names the config source in validation errors', () => {
    expect(() => parseConfig({}, SOURCE)).toThrow(SOURCE);
  });
});

describe('loadConfig', () => {
  let dir: string;

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'devshare-test-'));
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  async function writeConfig(content: string): Promise<string> {
    const path = join(dir, 'config.json');
    await writeFile(path, content, 'utf8');
    return path;
  }

  it('loads a valid config file', async () => {
    const path = await writeConfig(JSON.stringify({ destinations: [destinationEntry(general)] }));

    await expect(loadConfig(path)).resolves.toEqual({ destinations: [general] });
  });

  it('accepts a file saved with a UTF-8 byte-order mark', async () => {
    const path = await writeConfig(
      '\uFEFF' + JSON.stringify({ destinations: [destinationEntry(general)] }),
    );

    await expect(loadConfig(path)).resolves.toEqual({ destinations: [general] });
  });

  it('reports a missing config file', async () => {
    await expect(loadConfig(join(dir, 'missing.json'))).rejects.toMatchObject({
      code: 'CONFIG_NOT_FOUND',
    });
  });

  it('reports a config path that cannot be read as a file', async () => {
    await expect(loadConfig(dir)).rejects.toMatchObject({ code: 'CONFIG_NOT_READABLE' });
  });

  it('reports malformed JSON', async () => {
    const path = await writeConfig('{ "destinations": [ }');

    await expect(loadConfig(path)).rejects.toMatchObject({ code: 'INVALID_CONFIG' });
  });
});

describe('resolveDestination', () => {
  const twoDestinations: DevShareConfig = { destinations: [general, backend] };

  it('finds a destination by name, ignoring case', () => {
    expect(resolveDestination(twoDestinations, 'backend')).toBe(backend);
  });

  it('uses the default destination when no name is given', () => {
    expect(resolveDestination({ ...twoDestinations, defaultDestination: 'Backend' })).toBe(backend);
  });

  it('prefers an explicit name over the default destination', () => {
    expect(
      resolveDestination({ ...twoDestinations, defaultDestination: 'Backend' }, 'General'),
    ).toBe(general);
  });

  it('uses the only destination when there is exactly one', () => {
    expect(resolveDestination({ destinations: [general] })).toBe(general);
  });

  it('requires a choice when several destinations exist and there is no default', () => {
    expect(() => resolveDestination(twoDestinations)).toThrow(
      expect.objectContaining({ code: 'DESTINATION_REQUIRED' }),
    );
  });

  it('reports an unknown destination and lists the available ones', () => {
    expect(() => resolveDestination(twoDestinations, 'Bugs')).toThrow(
      expect.objectContaining({
        code: 'DESTINATION_NOT_FOUND',
        message: 'Unknown destination "Bugs". Available: General, Backend.',
      }),
    );
  });
});
