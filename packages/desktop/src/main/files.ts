import { stat } from 'node:fs/promises';
import { basename } from 'node:path';

import { DevShareError, readFileAttachment, type Attachment } from '@devshare/core';

/** Attached files are held in memory until shared, so very large files are refused. */
export const MAX_ATTACHMENT_BYTES = 25 * 1024 * 1024;

/** Reads a file the user chose into an attachment, refusing files over the size limit. */
export async function readAttachmentWithinLimit(path: string): Promise<Attachment> {
  const size = await stat(path).then(
    (stats) => stats.size,
    // Missing or unreadable files are reported by readFileAttachment with a clear message.
    () => undefined,
  );
  if (size !== undefined && size > MAX_ATTACHMENT_BYTES) {
    throw new DevShareError(
      'INVALID_ATTACHMENT',
      `"${basename(path)}" is larger than ${String(MAX_ATTACHMENT_BYTES / 1024 / 1024)} MB.`,
    );
  }
  return readFileAttachment(path);
}
