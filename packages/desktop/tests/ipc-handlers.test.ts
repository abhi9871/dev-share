import {
  DevShareError,
  type Attachment,
  type DestinationList,
  type SharePayload,
} from '@devshare/core';
import { describe, expect, it, vi } from 'vitest';

import { AttachmentStore } from '../src/main/attachment-store.js';
import {
  createIpcHandlers,
  MAX_TEXT_LENGTH,
  type IpcHandlerDependencies,
} from '../src/main/ipc-handlers.js';
import { IPC_CHANNELS, type IpcResult } from '../src/shared/ipc.js';

const NO_DESTINATIONS: DestinationList = { destinations: [], defaultDestination: undefined };

const INVALID_REQUEST = {
  ok: false,
  error: { code: 'INVALID_REQUEST', message: 'Invalid request.' },
};

function file(name: string, content = 'content'): Attachment {
  return { name, mediaType: 'text/plain', data: new TextEncoder().encode(content) };
}

function createHandlers(overrides: Partial<IpcHandlerDependencies> = {}) {
  return createIpcHandlers({
    loadSharingService: () =>
      Promise.resolve({
        listDestinations: () => NO_DESTINATIONS,
        share: (_payload: SharePayload, destination?: string) =>
          Promise.resolve({ destination: destination ?? 'default' }),
      }),
    chooseFiles: () => Promise.resolve([]),
    readAttachment: (path) => Promise.resolve(file(path)),
    attachments: new AttachmentStore(),
    ...overrides,
  });
}

function handlersReturning(list: () => DestinationList) {
  return createHandlers({
    loadSharingService: () =>
      Promise.resolve({ listDestinations: list, share: () => Promise.reject(new Error('unused')) }),
  });
}

/** Returns handlers whose sharing service records each share it is asked to send. */
function sharingHandlers() {
  const store = new AttachmentStore();
  const share = vi.fn((_payload: SharePayload, destination?: string) =>
    Promise.resolve({ destination: destination ?? 'default' }),
  );
  const handlers = createHandlers({
    loadSharingService: () => Promise.resolve({ listDestinations: () => NO_DESTINATIONS, share }),
    attachments: store,
  });
  return { handlers, share, store };
}

function unwrap<T>(result: IpcResult<T>): T {
  if (!result.ok) {
    throw new Error(`Expected success, got ${result.error.code}: ${result.error.message}`);
  }
  return result.value;
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
    const handlers = createHandlers({
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

describe('pickFiles handler', () => {
  it('stores the chosen files and returns views of them without their paths', async () => {
    const store = new AttachmentStore();
    const handlers = createHandlers({
      chooseFiles: () => Promise.resolve(['C:\\logs\\app.log', 'C:\\shots\\error.png']),
      readAttachment: (path) => Promise.resolve(file(path.split('\\').at(-1) ?? path, 'abc')),
      attachments: store,
    });

    const views = unwrap(await handlers.pickFiles(undefined));

    expect(views.map(({ name, mediaType, size }) => ({ name, mediaType, size }))).toEqual([
      { name: 'app.log', mediaType: 'text/plain', size: 3 },
      { name: 'error.png', mediaType: 'text/plain', size: 3 },
    ]);
    expect(JSON.stringify(views)).not.toContain('C:');
    expect(views.map((view) => store.get(view.id)?.name)).toEqual(['app.log', 'error.png']);
  });

  it('returns no files when the user cancels', async () => {
    const handlers = createHandlers({ chooseFiles: () => Promise.resolve([]) });

    await expect(handlers.pickFiles(undefined)).resolves.toEqual({ ok: true, value: [] });
  });

  it('stores nothing when any chosen file cannot be read', async () => {
    const store = new AttachmentStore();
    const add = vi.spyOn(store, 'add');
    const handlers = createHandlers({
      chooseFiles: () => Promise.resolve(['ok.txt', 'missing.txt']),
      readAttachment: (path) =>
        path === 'missing.txt'
          ? Promise.reject(new DevShareError('FILE_NOT_FOUND', 'File not found: "missing.txt".'))
          : Promise.resolve(file(path)),
      attachments: store,
    });

    await expect(handlers.pickFiles(undefined)).resolves.toEqual({
      ok: false,
      error: { code: 'FILE_NOT_FOUND', message: 'File not found: "missing.txt".' },
    });
    expect(add).not.toHaveBeenCalled();
  });
});

describe('removeAttachment handler', () => {
  it('discards the attachment', async () => {
    const store = new AttachmentStore();
    const id = store.add(file('a.txt'));
    const handlers = createHandlers({ attachments: store });

    await expect(handlers.removeAttachment(id)).resolves.toEqual({ ok: true, value: undefined });
    expect(store.get(id)).toBeUndefined();
  });

  it('rejects input that is not an ID', async () => {
    await expect(createHandlers().removeAttachment({ id: 'x' })).resolves.toEqual(INVALID_REQUEST);
  });
});

describe('share handler', () => {
  it('shares the message and stored attachments to the chosen destination', async () => {
    const { handlers, share, store } = sharingHandlers();
    const id = store.add(file('app.log', 'log line'));

    await expect(
      handlers.share({ destination: 'backend', text: 'Build failed', attachmentIds: [id] }),
    ).resolves.toEqual({ ok: true, value: { destination: 'backend' } });
    expect(share).toHaveBeenCalledWith(
      { text: 'Build failed', attachments: [file('app.log', 'log line')] },
      'backend',
    );
  });

  it('discards attachments once they are shared', async () => {
    const { handlers, store } = sharingHandlers();
    const id = store.add(file('a.txt'));

    unwrap(await handlers.share({ destination: 'general', text: '', attachmentIds: [id] }));

    expect(store.get(id)).toBeUndefined();
  });

  it('keeps attachments when sharing fails, so the user can retry', async () => {
    const store = new AttachmentStore();
    const id = store.add(file('a.txt'));
    const handlers = createHandlers({
      loadSharingService: () =>
        Promise.resolve({
          listDestinations: () => NO_DESTINATIONS,
          share: () =>
            Promise.reject(new DevShareError('NETWORK_ERROR', 'Could not reach Discord.')),
        }),
      attachments: store,
    });

    await expect(
      handlers.share({ destination: 'general', text: '', attachmentIds: [id] }),
    ).resolves.toEqual({
      ok: false,
      error: { code: 'NETWORK_ERROR', message: 'Could not reach Discord.' },
    });
    expect(store.get(id)).toBeDefined();
  });

  it('reports an empty share with the core error code', async () => {
    const { handlers, share } = sharingHandlers();

    const result = await handlers.share({ destination: 'general', text: '  ', attachmentIds: [] });

    expect(result).toMatchObject({ ok: false, error: { code: 'EMPTY_PAYLOAD' } });
    expect(share).not.toHaveBeenCalled();
  });

  it('rejects attachment IDs it did not issue, such as file paths', async () => {
    const { handlers, share } = sharingHandlers();

    const result = await handlers.share({
      destination: 'general',
      text: 'hi',
      attachmentIds: ['C:\\Users\\me\\.ssh\\id_rsa'],
    });

    expect(result).toMatchObject({ ok: false, error: { code: 'INVALID_REQUEST' } });
    expect(share).not.toHaveBeenCalled();
  });

  it('rejects the same attachment listed twice', async () => {
    const { handlers, share, store } = sharingHandlers();
    const id = store.add(file('a.txt'));

    await expect(
      handlers.share({ destination: 'general', text: '', attachmentIds: [id, id] }),
    ).resolves.toEqual(INVALID_REQUEST);
    expect(share).not.toHaveBeenCalled();
  });

  it.each([
    ['no request', undefined],
    ['a non-object request', 'hello'],
    ['a missing destination', { text: 'hi', attachmentIds: [] }],
    ['an empty destination', { destination: '', text: 'hi', attachmentIds: [] }],
    ['non-string text', { destination: 'general', text: 42, attachmentIds: [] }],
    [
      'oversized text',
      { destination: 'general', text: 'x'.repeat(MAX_TEXT_LENGTH + 1), attachmentIds: [] },
    ],
    ['non-array attachment IDs', { destination: 'general', text: 'hi', attachmentIds: 'id' }],
    ['non-string attachment IDs', { destination: 'general', text: 'hi', attachmentIds: [1] }],
  ])('rejects %s', async (_case, input) => {
    const { handlers, share } = sharingHandlers();

    await expect(handlers.share(input)).resolves.toEqual(INVALID_REQUEST);
    expect(share).not.toHaveBeenCalled();
  });
});

describe('IPC contract', () => {
  it('uses a distinct, namespaced channel for every API method', () => {
    const channels = Object.values(IPC_CHANNELS);

    expect(new Set(channels).size).toBe(channels.length);
    expect(channels.every((channel) => channel.startsWith('devshare:'))).toBe(true);
  });
});
