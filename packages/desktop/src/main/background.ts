import type { MenuItemConstructorOptions } from 'electron';

/** The parts of the main window that running in the background needs. */
export interface BackgroundWindow {
  on(event: 'close', listener: (event: { preventDefault(): void }) => void): unknown;
  hide(): void;
  show(): void;
  focus(): void;
  restore(): void;
  isMinimized(): boolean;
}

export interface TrayActions {
  readonly open: () => void;
  readonly quit: () => void;
}

/**
 * Makes closing the window hide it instead, so DevShare keeps running in the tray.
 * `onFirstHide` runs the first time this happens, to tell the user where the app went.
 * Returns a function to call when quitting, after which closing really closes the window.
 */
export function hideOnClose(window: BackgroundWindow, onFirstHide: () => void): () => void {
  let quitting = false;
  let hiddenBefore = false;
  window.on('close', (event) => {
    if (quitting) {
      return;
    }
    event.preventDefault();
    window.hide();
    if (!hiddenBefore) {
      hiddenBefore = true;
      onFirstHide();
    }
  });
  return () => {
    quitting = true;
  };
}

/** Brings the window to the front, whether it was hidden, minimized, or behind others. */
export function showWindow(window: BackgroundWindow): void {
  if (window.isMinimized()) {
    window.restore();
  }
  window.show();
  window.focus();
}

export function trayMenuTemplate(actions: TrayActions): MenuItemConstructorOptions[] {
  return [
    { label: 'Open DevShare', click: actions.open },
    { type: 'separator' },
    { label: 'Quit DevShare', click: actions.quit },
  ];
}
