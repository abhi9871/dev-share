import { DevShareError } from './errors.js';

/** A single piece of binary content to share, such as a file, screenshot, or PDF. */
export interface Attachment {
  /** File name shown to recipients, e.g. `screenshot.png`. */
  readonly name: string;
  /** IANA media type, e.g. `image/png`. */
  readonly mediaType: string;
  readonly data: Uint8Array;
}

/** Everything sent together in one share operation. */
export interface SharePayload {
  readonly text?: string;
  readonly attachments: readonly Attachment[];
}

export interface SharePayloadInput {
  readonly text?: string | undefined;
  readonly attachments?: readonly Attachment[] | undefined;
}

/**
 * Builds a validated payload. Text is kept verbatim (whitespace matters in code and logs),
 * but text that is only whitespace is treated as absent.
 */
export function createSharePayload(input: SharePayloadInput): SharePayload {
  const attachments = input.attachments ?? [];
  attachments.forEach(validateAttachment);

  const text = input.text?.trim() ? input.text : undefined;
  if (text === undefined && attachments.length === 0) {
    throw new DevShareError(
      'EMPTY_PAYLOAD',
      'Nothing to share: provide text or at least one file.',
    );
  }

  return text === undefined ? { attachments } : { text, attachments };
}

function validateAttachment(attachment: Attachment): void {
  if (!attachment.name.trim()) {
    throw new DevShareError('INVALID_ATTACHMENT', 'An attachment is missing a file name.');
  }
  if (attachment.data.byteLength === 0) {
    throw new DevShareError('INVALID_ATTACHMENT', `"${attachment.name}" is empty.`);
  }
}
