import { open } from 'node:fs/promises';
import { basename, extname } from 'node:path';

import { DevShareError } from './errors.js';
import type { Attachment } from './payload.js';

const DEFAULT_MEDIA_TYPE = 'application/octet-stream';

/** Media types for common developer-shared files. Anything else is sent as binary. */
const MEDIA_TYPES_BY_EXTENSION: Readonly<Record<string, string>> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.pdf': 'application/pdf',
  '.json': 'application/json',
  '.txt': 'text/plain',
  '.log': 'text/plain',
  '.md': 'text/markdown',
  '.csv': 'text/csv',
};

export function mediaTypeForFileName(fileName: string): string {
  return MEDIA_TYPES_BY_EXTENSION[extname(fileName).toLowerCase()] ?? DEFAULT_MEDIA_TYPE;
}

/** Reads a file from disk into an attachment named after the file. */
export async function readFileAttachment(path: string): Promise<Attachment> {
  const name = basename(path);
  try {
    const file = await open(path, 'r');
    try {
      if (!(await file.stat()).isFile()) {
        throw new DevShareError('NOT_A_FILE', `"${path}" is not a file.`);
      }
      return { name, mediaType: mediaTypeForFileName(name), data: await file.readFile() };
    } finally {
      await file.close();
    }
  } catch (error) {
    throw toDevShareError(error, path);
  }
}

function toDevShareError(error: unknown, path: string): DevShareError {
  if (error instanceof DevShareError) {
    return error;
  }
  switch (errorCode(error)) {
    case 'ENOENT':
      return new DevShareError('FILE_NOT_FOUND', `File not found: "${path}".`, { cause: error });
    case 'EISDIR':
      return new DevShareError('NOT_A_FILE', `"${path}" is not a file.`, { cause: error });
    case 'EACCES':
    case 'EPERM':
      return new DevShareError('FILE_NOT_READABLE', `Permission denied reading "${path}".`, {
        cause: error,
      });
    default:
      return new DevShareError('FILE_NOT_READABLE', `Could not read "${path}".`, { cause: error });
  }
}

function errorCode(error: unknown): string | undefined {
  return error instanceof Error && 'code' in error && typeof error.code === 'string'
    ? error.code
    : undefined;
}
