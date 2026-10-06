import { mkdtemp, rm, truncate, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { AttachmentStore } from '../src/main/attachment-store.js';
import { MAX_ATTACHMENT_BYTES, readAttachmentWithinLimit } from '../src/main/files.js';

const attachment = { name: 'a.txt', mediaType: 'text/plain', data: new Uint8Array([1]) };

describe('AttachmentStore', () => {
  it('returns stored attachments by their ID', () => {
    const store = new AttachmentStore();

    const id = store.add(attachment);

    expect(store.get(id)).toBe(attachment);
  });

  it('gives every attachment a distinct ID, even the same file added twice', () => {
    const store = new AttachmentStore();

    expect(store.add(attachment)).not.toBe(store.add(attachment));
  });

  it('forgets deleted attachments', () => {
    const store = new AttachmentStore();
    const id = store.add(attachment);

    store.delete(id);

    expect(store.get(id)).toBeUndefined();
  });
});

describe('readAttachmentWithinLimit', () => {
  let dir: string;

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'devshare-desktop-'));
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it('reads files up to the size limit', async () => {
    const path = join(dir, 'app.log');
    await writeFile(path, 'log line');

    const result = await readAttachmentWithinLimit(path);

    expect(result.name).toBe('app.log');
    expect(new TextDecoder().decode(result.data)).toBe('log line');
  });

  it('refuses files over the size limit without reading them', async () => {
    const path = join(dir, 'huge.bin');
    await writeFile(path, '');
    await truncate(path, MAX_ATTACHMENT_BYTES + 1);

    await expect(readAttachmentWithinLimit(path)).rejects.toMatchObject({
      code: 'INVALID_ATTACHMENT',
      message: '"huge.bin" is larger than 25 MB.',
    });
  });

  it('reports missing files with the core error', async () => {
    await expect(readAttachmentWithinLimit(join(dir, 'missing.txt'))).rejects.toMatchObject({
      code: 'FILE_NOT_FOUND',
    });
  });
});
