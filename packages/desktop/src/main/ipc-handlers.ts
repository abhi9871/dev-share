import {
  createSharePayload,
  DevShareError,
  type Attachment,
  type SharingService,
} from '@devshare/core';

import type {
  AttachmentView,
  DevShareApi,
  IpcError,
  IpcResult,
  ShareRequest,
} from '../shared/ipc.js';
import type { AttachmentStore } from './attachment-store.js';

/** Longest message accepted from the renderer; far beyond anything typed or pasted by hand. */
export const MAX_TEXT_LENGTH = 1_000_000;

export interface IpcHandlerDependencies {
  /** Loads the user's current configuration; called per request so config edits apply. */
  readonly loadSharingService: () => Promise<Pick<SharingService, 'listDestinations' | 'share'>>;
  /** Asks the user to choose files; resolves with their paths, or none if cancelled. */
  readonly chooseFiles: () => Promise<readonly string[]>;
  readonly readAttachment: (path: string) => Promise<Attachment>;
  readonly attachments: AttachmentStore;
}

/**
 * Main-process implementation of each API method. Handlers receive renderer input as
 * `unknown` and must validate it, because the renderer is untrusted.
 */
export type IpcHandlers = {
  readonly [Method in keyof DevShareApi]: (input: unknown) => ReturnType<DevShareApi[Method]>;
};

export function createIpcHandlers(deps: IpcHandlerDependencies): IpcHandlers {
  return {
    getDestinations: () =>
      toResult(async () => {
        const { destinations, defaultDestination } = (
          await deps.loadSharingService()
        ).listDestinations();
        return { destinations, defaultDestination };
      }),

    pickFiles: () =>
      toResult(async () => {
        const paths = await deps.chooseFiles();
        // Read every file before storing any, so a failure leaves nothing half-attached.
        const files = await Promise.all(paths.map((path) => deps.readAttachment(path)));
        return files.map((file) => toAttachmentView(deps.attachments.add(file), file));
      }),

    removeAttachment: (input) =>
      toResult(() => {
        if (typeof input !== 'string') {
          throw new InvalidRequestError();
        }
        deps.attachments.delete(input);
      }),

    share: (input) =>
      toResult(async () => {
        const request = parseShareRequest(input);
        const attachments = request.attachmentIds.map((id) => {
          const attachment = deps.attachments.get(id);
          if (!attachment) {
            throw new InvalidRequestError('An attached file is no longer available; add it again.');
          }
          return attachment;
        });
        const payload = createSharePayload({ text: request.text, attachments });
        const result = await (await deps.loadSharingService()).share(payload, request.destination);
        request.attachmentIds.forEach((id) => {
          deps.attachments.delete(id);
        });
        return { destination: result.destination };
      }),
  };
}

function parseShareRequest(input: unknown): ShareRequest {
  if (typeof input !== 'object' || input === null) {
    throw new InvalidRequestError();
  }
  const { destination, text, attachmentIds } = input as Partial<
    Record<keyof ShareRequest, unknown>
  >;
  if (
    typeof destination !== 'string' ||
    destination === '' ||
    typeof text !== 'string' ||
    text.length > MAX_TEXT_LENGTH ||
    !Array.isArray(attachmentIds) ||
    !attachmentIds.every((id) => typeof id === 'string') ||
    new Set(attachmentIds).size !== attachmentIds.length
  ) {
    throw new InvalidRequestError();
  }
  return { destination, text, attachmentIds };
}

function toAttachmentView(id: string, attachment: Attachment): AttachmentView {
  return {
    id,
    name: attachment.name,
    mediaType: attachment.mediaType,
    size: attachment.data.byteLength,
  };
}

/** Renderer input that does not match the IPC contract. */
class InvalidRequestError extends Error {
  constructor(message = 'Invalid request.') {
    super(message);
  }
}

/** Runs an action and converts failures into a serializable error for the renderer. */
async function toResult<T>(action: () => T | Promise<T>): Promise<IpcResult<T>> {
  try {
    return { ok: true, value: await action() };
  } catch (error) {
    return { ok: false, error: toIpcError(error) };
  }
}

function toIpcError(error: unknown): IpcError {
  if (error instanceof DevShareError) {
    return { code: error.code, message: error.message };
  }
  if (error instanceof InvalidRequestError) {
    return { code: 'INVALID_REQUEST', message: error.message };
  }
  return {
    code: 'UNEXPECTED',
    message: `Unexpected error: ${error instanceof Error ? error.message : String(error)}`,
  };
}
