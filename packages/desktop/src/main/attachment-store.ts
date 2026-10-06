import { randomUUID } from 'node:crypto';

import type { Attachment } from '@devshare/core';

/**
 * Files the user attached, held in the main process until they are shared or removed. The
 * renderer only ever learns their IDs, so it can never make DevShare read an arbitrary path.
 */
export class AttachmentStore {
  readonly #attachments = new Map<string, Attachment>();

  /** Stores an attachment and returns its new ID. */
  add(attachment: Attachment): string {
    const id = randomUUID();
    this.#attachments.set(id, attachment);
    return id;
  }

  get(id: string): Attachment | undefined {
    return this.#attachments.get(id);
  }

  delete(id: string): void {
    this.#attachments.delete(id);
  }
}
