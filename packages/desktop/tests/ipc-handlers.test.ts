import { DevShareError, type DestinationList } from '@devshare/core';
import { describe, expect, it } from 'vitest';

import { createIpcHandlers } from '../src/main/ipc-handlers.js';
import { IPC_CHANNELS } from '../src/shared/ipc.js';

function handlersReturning(list: () => DestinationList) {
  return createIpcHandlers({
    loadSharingService: () => Promise.resolve({ listDestinations: list }),
  });
}

describe('getDestinations handler', () => {
  it('returns destination names, types, and the default', async () => {
    const handlers = handlersReturning(() => ({
      destinations: [
        { name: 'general', type: 'discord' },
        { name: 'backend', type: 'discord' },
      ],
      defaultDestination: 'general',
    }));

    await expect(handlers.getDestinations(undefined)).resolves.toEqual({
      ok: true,
      value: {
        destinations: [
          { name: 'general', type: 'discord' },
          { name: 'backend', type: 'discord' },
        ],
        defaultDestination: 'general',
      },
    });
  });

  it('sends only the fields defined by the IPC contract to the renderer', async () => {
    const withExtraField = {
      destinations: [{ name: 'general', type: 'discord' }],
      defaultDestination: undefined,
      settings: { webhookEnv: 'DEVSHARE_GENERAL_WEBHOOK' },
    };
    const handlers = handlersReturning(() => withExtraField);

    const result = await handlers.getDestinations(undefined);

    expect(JSON.stringify(result)).not.toContain('webhookEnv');
  });

  it('turns configuration errors into serializable errors with their code', async () => {
    const handlers = createIpcHandlers({
      loadSharingService: () =>
        Promise.reject(new DevShareError('CONFIG_NOT_FOUND', 'Config file not found: "x".')),
    });

    await expect(handlers.getDestinations(undefined)).resolves.toEqual({
      ok: false,
      error: { code: 'CONFIG_NOT_FOUND', message: 'Config file not found: "x".' },
    });
  });

  it('reports unexpected failures without throwing across IPC', async () => {
    const handlers = handlersReturning(() => {
      throw new TypeError('boom');
    });

    await expect(handlers.getDestinations(undefined)).resolves.toEqual({
      ok: false,
      error: { code: 'UNEXPECTED', message: 'Unexpected error: boom' },
    });
  });
});

describe('IPC contract', () => {
  it('uses a distinct, namespaced channel for every API method', () => {
    const channels = Object.values(IPC_CHANNELS);

    expect(new Set(channels).size).toBe(channels.length);
    expect(channels.every((channel) => channel.startsWith('devshare:'))).toBe(true);
  });
});
