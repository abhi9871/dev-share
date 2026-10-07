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
  LaunchStateView,
  PreferencesView,
  ShareRequest,
} from '../shared/ipc.js';
import type { AttachmentStore } from './attachment-store.js';
import { DesktopError, invalidRequest } from './errors.js';
import { MAX_ATTACHMENT_BYTES } from './files.js';

/** Longest message accepted from the renderer; far beyond anything typed or pasted by hand. */
export const MAX_TEXT_LENGTH = 1_000_000;

export interface IpcHandlerDependencies {
  /** Loads the user's current configuration; called per request so config edits apply. */
  readonly loadSharingService: () => Promise<Pick<SharingService, 'listDestinations' | 'share'>>;
  /** Asks the user to choose files; resolves with their paths, or none if cancelled. */
  readonly chooseFiles: () => Promise<readonly string[]>;
  readonly readAttachment: (path: string) => Promise<Attachment>;
  readonly attachments: AttachmentStore;
  readonly readClipboard: () => Promise<ClipboardContent>;
  /** Current time, used to name images pasted from the clipboard. */
  readonly now: () => Date;
  readonly preferences: {
    view(): PreferencesView;
    /** Validates renderer input itself; see `PreferencesService.update`. */
    update(input: unknown): Promise<PreferencesView>;
  };
  readonly launchState: LaunchStateView;
}

/** The system clipboard's contents, as read by the main process. */
export interface ClipboardContent {
  /** Copied text, or an empty string if there is none. */
  readonly text: string;
  readonly image?: {
    readonly png: Uint8Array;
    /** Small thumbnail of the image as a `data:` URL. */
    readonly previewUrl: string;
  };
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

    getLaunchState: () => toResult(() => deps.launchState),

    getPreferences: () => toResult(() => deps.preferences.view()),

    updatePreferences: (input) => toResult(() => deps.preferences.update(input)),

    pickFiles: () =>
      toResult(async () => {
        const paths = await deps.chooseFiles();
        // Read every file before storing any, so a failure leaves nothing half-attached.
        const files = await Promise.all(paths.map((path) => deps.readAttachment(path)));
        return files.map((file) => toAttachmentView(deps.attachments.add(file), file));
      }),

    readClipboard: () =>
      toResult(async () => {
        const { text, image } = await deps.readClipboard();
        if (text.length > MAX_TEXT_LENGTH) {
          throw new DevShareError(
            'UNSUPPORTED_PAYLOAD',
            'The copied text is too long for a message; save it to a file and attach that instead.',
          );
        }
        if (!image) {
          return { text, image: undefined };
        }
        if (image.png.byteLength > MAX_ATTACHMENT_BYTES) {
          throw new DevShareError(
            'INVALID_ATTACHMENT',
            `The copied image is larger than ${String(MAX_ATTACHMENT_BYTES / 1024 / 1024)} MB.`,
          );
        }
        const attachment: Attachment = {
          name: clipboardImageName(deps.now()),
          mediaType: 'image/png',
          data: image.png,
        };
        const id = deps.attachments.add(attachment);
        return {
          text,
          image: { ...toAttachmentView(id, attachment), previewUrl: image.previewUrl },
        };
      }),

    removeAttachment: (input) =>
      toResult(() => {
        if (typeof input !== 'string') {
          throw invalidRequest();
        }
        deps.attachments.delete(input);
      }),

    share: (input) =>
      toResult(async () => {
        const request = parseShareRequest(input);
        const attachments = request.attachmentIds.map((id) => {
          const attachment = deps.attachments.get(id);
          if (!attachment) {
            throw invalidRequest('An attached file is no longer available; add it again.');
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
    throw invalidRequest();
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
    throw invalidRequest();
  }
  return { destination, text, attachmentIds };
}

/** Names a pasted image after the local time it was pasted, e.g. `clipboard-2026-10-06-153012.png`. */
export function clipboardImageName(date: Date): string {
  const pad = (value: number) => String(value).padStart(2, '0');
  const day = `${String(date.getFullYear())}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
  const time = `${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`;
  return `clipboard-${day}-${time}.png`;
}

function toAttachmentView(id: string, attachment: Attachment): AttachmentView {
  return {
    id,
    name: attachment.name,
    mediaType: attachment.mediaType,
    size: attachment.data.byteLength,
  };
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
  if (error instanceof DesktopError) {
    return { code: error.code, message: error.message };
  }
  return {
    code: 'UNEXPECTED',
    message: `Unexpected error: ${error instanceof Error ? error.message : String(error)}`,
  };
}
