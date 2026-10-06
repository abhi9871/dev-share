import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { readEnvFile } from '../src/env-file.js';
import {
  createSharePayload,
  loadLocalSharingService,
  type Environment,
  type TransportFactory,
} from '../src/index.js';

let dir: string;

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'devshare-test-'));
});

afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

describe('readEnvFile', () => {
  it('reads KEY=value pairs, ignoring comments', async () => {
    const path = join(dir, '.env');
    await writeFile(path, '# DevShare secrets\nFIRST=one\nSECOND="two words"\n');

    await expect(readEnvFile(path)).resolves.toEqual({ FIRST: 'one', SECOND: 'two words' });
  });

  it('keeps the first variable name intact when the file has a byte-order mark', async () => {
    const path = join(dir, '.env');
    await writeFile(path, '\uFEFFFIRST=one\n');

    await expect(readEnvFile(path)).resolves.toEqual({ FIRST: 'one' });
  });

  it('treats a missing file as empty', async () => {
    await expect(readEnvFile(join(dir, '.env'))).resolves.toEqual({});
  });

  it('reports a path that cannot be read as a file', async () => {
    await expect(readEnvFile(dir)).rejects.toMatchObject({ code: 'ENV_FILE_NOT_READABLE' });
  });
});

describe('loadLocalSharingService', () => {
  /** A transport that records the environment it was created with instead of sending. */
  function recordingTransport() {
    const seen: Environment[] = [];
    const factory: TransportFactory = {
      type: 'fake',
      create: (_destination, env) => {
        seen.push(env);
        return { send: () => Promise.resolve() };
      },
    };
    return { factory, seen };
  }

  async function writeSetup(envFile?: string): Promise<string> {
    const configPath = join(dir, 'config.json');
    await writeFile(
      configPath,
      JSON.stringify({ destinations: [{ name: 'General', type: 'fake' }] }),
    );
    if (envFile !== undefined) {
      await writeFile(join(dir, '.env'), envFile);
    }
    return configPath;
  }

  const payload = createSharePayload({ text: 'hello' });

  it('shares using the config file and the .env file next to it', async () => {
    const configPath = await writeSetup('FROM_FILE=file-value\n');
    const { factory, seen } = recordingTransport();

    const service = await loadLocalSharingService({ configPath, env: {}, transports: [factory] });

    await expect(service.share(payload)).resolves.toEqual({ destination: 'General' });
    expect(seen[0]).toMatchObject({ FROM_FILE: 'file-value' });
  });

  it('lets real environment variables override the .env file', async () => {
    const configPath = await writeSetup('SHARED=file-value\n');
    const { factory, seen } = recordingTransport();

    const service = await loadLocalSharingService({
      configPath,
      env: { SHARED: 'process-value' },
      transports: [factory],
    });
    await service.share(payload);

    expect(seen[0]).toMatchObject({ SHARED: 'process-value' });
  });

  it('finds the config through DEVSHARE_CONFIG when no path is given', async () => {
    const configPath = await writeSetup();
    const { factory } = recordingTransport();

    const service = await loadLocalSharingService({
      env: { DEVSHARE_CONFIG: configPath },
      transports: [factory],
    });

    await expect(service.share(payload)).resolves.toEqual({ destination: 'General' });
  });

  it('reports a missing config file', async () => {
    await expect(
      loadLocalSharingService({ configPath: join(dir, 'missing.json'), env: {} }),
    ).rejects.toMatchObject({ code: 'CONFIG_NOT_FOUND' });
  });
});
