import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { DevShareError, mediaTypeForFileName, readFileAttachment } from '../src/index.js';

describe('mediaTypeForFileName', () => {
  it.each([
    ['screenshot.png', 'image/png'],
    ['photo.JPEG', 'image/jpeg'],
    ['report.pdf', 'application/pdf'],
    ['server.log', 'text/plain'],
    ['publicClient.ts', 'application/octet-stream'],
    ['Makefile', 'application/octet-stream'],
  ])('maps %s to %s', (fileName, mediaType) => {
    expect(mediaTypeForFileName(fileName)).toBe(mediaType);
  });
});

describe('readFileAttachment', () => {
  let dir: string;

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'devshare-test-'));
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it('reads a file into an attachment named after the file', async () => {
    const path = join(dir, 'screenshot.png');
    await writeFile(path, new Uint8Array([137, 80, 78, 71]));

    const attachment = await readFileAttachment(path);

    expect(attachment.name).toBe('screenshot.png');
    expect(attachment.mediaType).toBe('image/png');
    expect([...attachment.data]).toEqual([137, 80, 78, 71]);
  });

  it('reports a missing file', async () => {
    await expect(readFileAttachment(join(dir, 'missing.txt'))).rejects.toMatchObject({
      code: 'FILE_NOT_FOUND',
    });
  });

  it('reports a directory as not a file', async () => {
    await expect(readFileAttachment(dir)).rejects.toBeInstanceOf(DevShareError);
    await expect(readFileAttachment(dir)).rejects.toMatchObject({ code: 'NOT_A_FILE' });
  });
});
