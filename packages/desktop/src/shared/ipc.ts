/**
 * IPC contract between the renderer (untrusted UI) and the main process (privileged).
 * The renderer only ever sees data defined here; secrets and destination settings never
 * cross this boundary.
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

/** The API the preload script exposes to the renderer as `window.devshare`. */
export interface DevShareApi {
  getDestinations(): Promise<IpcResult<DestinationsView>>;
}

/** One IPC channel per API method. */
export const IPC_CHANNELS: { readonly [Method in keyof DevShareApi]: string } = {
  getDestinations: 'devshare:get-destinations',
};
