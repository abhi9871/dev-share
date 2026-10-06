import { loadLocalSharingService } from '@devshare/core';
import { app, dialog, session, type BrowserWindow, type Tray } from 'electron';

import { AttachmentStore } from './attachment-store.js';
import { hideOnClose, showWindow } from './background.js';
import { readSystemClipboard } from './clipboard.js';
import { readAttachmentWithinLimit } from './files.js';
import { registerIpcHandlers } from './ipc.js';
import { createIpcHandlers } from './ipc-handlers.js';
import { denyPermissionRequests, hardenWebContents } from './security.js';
import { createTray, showStillRunningNotice } from './tray.js';
import { createMainWindow, loadRenderer } from './window.js';

let mainWindow: BrowserWindow | undefined;
// Held for the app's lifetime; a tray that is garbage-collected disappears.
let tray: Tray | undefined;

async function start(): Promise<void> {
  await app.whenReady();
  denyPermissionRequests(session.defaultSession);

  const window = createMainWindow();
  mainWindow = window;
  const appTray = createTray({
    open: () => {
      showWindow(window);
    },
    quit: () => {
      app.quit();
    },
  });
  tray = appTray;
  app.on(
    'before-quit',
    hideOnClose(window, () => {
      showStillRunningNotice(appTray);
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

function showMainWindow(): void {
  if (mainWindow) {
    showWindow(mainWindow);
  }
}

if (app.requestSingleInstanceLock()) {
  app.on('web-contents-created', (_event, contents) => {
    hardenWebContents(contents);
  });
  // Starting DevShare again while it runs in the background brings up the existing window.
  app.on('second-instance', showMainWindow);
  app.on('will-quit', () => {
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
