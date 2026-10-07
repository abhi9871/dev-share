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
  /** Small `data:` URL thumbnail, for images from the clipboard. */
  readonly previewUrl?: string;
}

/** What was on the clipboard. Content is only shared when the user presses Share. */
export interface ClipboardView {
  /** Copied text, or an empty string if there is none. */
  readonly text: string;
  /** A copied image, already attached as a PNG file. */
  readonly image: AttachmentView | undefined;
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

export interface PreferencesView {
  /** Global shortcut that brings up DevShare, as an Electron accelerator. */
  readonly shortcut: string;
  /** False if the shortcut could not be registered, e.g. because another app uses it. */
  readonly shortcutActive: boolean;
  /** Whether bringing up DevShare with an empty form loads what was copied. */
  readonly loadClipboardOnOpen: boolean;
  /** Whether DevShare starts, in the tray, when the user signs in. */
  readonly startAtLogin: boolean;
}

/** Preferences to change; omitted ones stay as they are. */
export interface PreferencesUpdate {
  readonly shortcut?: string;
  readonly loadClipboardOnOpen?: boolean;
  readonly startAtLogin?: boolean;
}

export interface LaunchStateView {
  /** True when DevShare started hidden in the tray (at sign-in) rather than in a window. */
  readonly startedInTray: boolean;
}

/** The API the preload script exposes to the renderer as `window.devshare`. */
export interface DevShareApi {
  getDestinations(): Promise<IpcResult<DestinationsView>>;
  getLaunchState(): Promise<IpcResult<LaunchStateView>>;
  getPreferences(): Promise<IpcResult<PreferencesView>>;
  /** Applies and saves preference changes; resolves with all preferences afterwards. */
  updatePreferences(update: PreferencesUpdate): Promise<IpcResult<PreferencesView>>;
  /** Lets the user choose files to attach; resolves with none if they cancel. */
  pickFiles(): Promise<IpcResult<readonly AttachmentView[]>>;
  /** Reads the clipboard's text and image; the image is attached for sharing. */
  readClipboard(): Promise<IpcResult<ClipboardView>>;
  /** Discards an attached file that the user removed before sharing. */
  removeAttachment(id: string): Promise<IpcResult<void>>;
  /** Shares the message and attachments; shared attachments are then discarded. */
  share(request: ShareRequest): Promise<IpcResult<ShareResultView>>;
}

/** One IPC channel per API method. */
export const IPC_CHANNELS: { readonly [Method in keyof DevShareApi]: string } = {
  getDestinations: 'devshare:get-destinations',
  getLaunchState: 'devshare:get-launch-state',
  getPreferences: 'devshare:get-preferences',
  updatePreferences: 'devshare:update-preferences',
  pickFiles: 'devshare:pick-files',
  readClipboard: 'devshare:read-clipboard',
  removeAttachment: 'devshare:remove-attachment',
  share: 'devshare:share',
};

/** Notifications from the main process, which the renderer subscribes to. */
export interface DevShareEvents {
  /**
   * Called when the user brings DevShare up: with the global shortcut, from the tray, or by
   * starting it again. Returns a function that unsubscribes.
   */
  onSummoned(listener: () => void): () => void;
}

/** One IPC channel per main-to-renderer notification. */
export const IPC_EVENTS: { readonly [Event in keyof DevShareEvents]: string } = {
  onSummoned: 'devshare:summoned',
};
