import type { Session, WebContents } from 'electron';

/**
 * The renderer only ever shows DevShare's own UI: it may not open windows, navigate away,
 * or embed other content.
 */
export function hardenWebContents(contents: WebContents): void {
  contents.setWindowOpenHandler(() => ({ action: 'deny' }));
  contents.on('will-navigate', (event) => {
    event.preventDefault();
  });
  contents.on('will-attach-webview', (event) => {
    event.preventDefault();
  });
}

/** DevShare needs no browser permissions (camera, notifications, ...), so deny them all. */
export function denyPermissionRequests(session: Session): void {
  session.setPermissionRequestHandler((_contents, _permission, callback) => {
    callback(false);
  });
  session.setPermissionCheckHandler(() => false);
}
