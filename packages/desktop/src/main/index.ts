import { loadLocalSharingService } from '@devshare/core';
import { app, dialog, session, type BrowserWindow, type Tray } from 'electron';

import { IPC_EVENTS } from '../shared/ipc.js';
import { AttachmentStore } from './attachment-store.js';
import { hideOnClose, showWindow } from './background.js';
import { readSystemClipboard } from './clipboard.js';
import { readAttachmentWithinLimit } from './files.js';
import { registerIpcHandlers } from './ipc.js';
import { createIpcHandlers } from './ipc-handlers.js';
import { denyPermissionRequests, hardenWebContents } from './security.js';
import { registerShortcut, SHORTCUT_LABEL, unregisterShortcuts } from './shortcut.js';
import { createTray, showShortcutUnavailableNotice, showStillRunningNotice } from './tray.js';
import { createMainWindow, loadRenderer } from './window.js';

let mainWindow: BrowserWindow | undefined;
// Held for the app's lifetime; a tray that is garbage-collected disappears.
let tray: Tray | undefined;

async function start(): Promise<void> {
  await app.whenReady();
  denyPermissionRequests(session.defaultSession);

  const window = createMainWindow();
  mainWindow = window;
  const shortcutRegistered = registerShortcut(summonMainWindow);
  const shortcut = shortcutRegistered ? SHORTCUT_LABEL : undefined;
  const appTray = createTray(
    {
      open: summonMainWindow,
      quit: () => {
        app.quit();
      },
    },
    shortcut,
  );
  tray = appTray;
  if (!shortcutRegistered) {
    showShortcutUnavailableNotice(appTray, SHORTCUT_LABEL);
  }
  app.on(
    'before-quit',
    hideOnClose(window, () => {
      showStillRunningNotice(appTray, shortcut);
    }),
  );
  registerIpcHandlers(
    createIpcHandlers({
      loadSharingService: () => loadLocalSharingService(),
      chooseFiles: async () => {
        const result = await dialog.showOpenDialog(window, {
          title: 'Attach files',
          properties: ['openFile', 'multiSelections'],
        });
        return result.canceled ? [] : result.filePaths;
      },
      readAttachment: readAttachmentWithinLimit,
      attachments: new AttachmentStore(),
      readClipboard: readSystemClipboard,
      now: () => new Date(),
    }),
    // Only DevShare's own window, and only its top-level page, may call the API.
    (event) => event.sender === window.webContents && event.senderFrame === event.sender.mainFrame,
  );
  await loadRenderer(window);
}

/** Brings up the window and lets the renderer know, so it can pick up the clipboard. */
function summonMainWindow(): void {
  if (mainWindow) {
    showWindow(mainWindow);
    mainWindow.webContents.send(IPC_EVENTS.onSummoned);
  }
}

if (app.requestSingleInstanceLock()) {
  app.on('web-contents-created', (_event, contents) => {
    hardenWebContents(contents);
  });
  // Starting DevShare again while it runs in the background brings up the existing window.
  app.on('second-instance', summonMainWindow);
  app.on('will-quit', () => {
    unregisterShortcuts();
    // Remove the icon right away; Windows can otherwise leave a stale one in the tray.
    tray?.destroy();
  });

  start().catch((error: unknown) => {
    dialog.showErrorBox(
      'DevShare could not start',
      error instanceof Error ? error.message : String(error),
    );
    app.exit(1);
  });
} else {
  // DevShare is already running; its window is shown via 'second-instance'.
  app.quit();
}
