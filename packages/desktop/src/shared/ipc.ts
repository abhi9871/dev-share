/**
 * IPC contract between the renderer (untrusted UI) and the main process (privileged).
 * The renderer only ever sees data defined here; secrets and destination settings never
 * cross this boundary. Files stay in the main process: the renderer never sends file paths,
 * and refers to attached files only by the IDs the main process gives it.
 */

export interface IpcError {
  /** A `DevShareErrorCode`, or `UNEXPECTED` for failures that are not user-actionable. */
  readonly code: string;
  readonly message: string;
}

export type IpcResult<T> =
  { readonly ok: true; readonly value: T } | { readonly ok: false; readonly error: IpcError };

export interface DestinationView {
  readonly name: string;
  readonly type: string;
}

export interface DestinationsView {
  readonly destinations: readonly DestinationView[];
  readonly defaultDestination: string | undefined;
}

/** A file held by the main process, ready to be shared. */
export interface AttachmentView {
  /** Opaque ID the renderer uses to refer to this file. */
  readonly id: string;
  readonly name: string;
  readonly mediaType: string;
  /** Size in bytes. */
  readonly size: number;
}

export interface ShareRequest {
  readonly destination: string;
  /** Message text; may be empty when sharing only files. */
  readonly text: string;
  readonly attachmentIds: readonly string[];
}

export interface ShareResultView {
  /** Name of the destination the share was delivered to. */
  readonly destination: string;
}

/** The API the preload script exposes to the renderer as `window.devshare`. */
export interface DevShareApi {
  getDestinations(): Promise<IpcResult<DestinationsView>>;
  /** Lets the user choose files to attach; resolves with none if they cancel. */
  pickFiles(): Promise<IpcResult<readonly AttachmentView[]>>;
  /** Discards an attached file that the user removed before sharing. */
  removeAttachment(id: string): Promise<IpcResult<void>>;
  /** Shares the message and attachments; shared attachments are then discarded. */
  share(request: ShareRequest): Promise<IpcResult<ShareResultView>>;
}

/** One IPC channel per API method. */
export const IPC_CHANNELS: { readonly [Method in keyof DevShareApi]: string } = {
  getDestinations: 'devshare:get-destinations',
  pickFiles: 'devshare:pick-files',
  removeAttachment: 'devshare:remove-attachment',
  share: 'devshare:share',
};
