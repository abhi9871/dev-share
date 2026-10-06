import { loadLocalSharingService } from '@devshare/core';
import { app, dialog, session, type BrowserWindow } from 'electron';

import { AttachmentStore } from './attachment-store.js';
import { readAttachmentWithinLimit } from './files.js';
import { registerIpcHandlers } from './ipc.js';
import { createIpcHandlers } from './ipc-handlers.js';
import { denyPermissionRequests, hardenWebContents } from './security.js';
import { createMainWindow, loadRenderer } from './window.js';

let mainWindow: BrowserWindow | undefined;

async function start(): Promise<void> {
  await app.whenReady();
  denyPermissionRequests(session.defaultSession);

  const window = createMainWindow();
  mainWindow = window;
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
    }),
    // Only DevShare's own window, and only its top-level page, may call the API.
    (event) => event.sender === window.webContents && event.senderFrame === event.sender.mainFrame,
  );
  await loadRenderer(window);
}

function focusMainWindow(): void {
  if (mainWindow?.isMinimized()) {
    mainWindow.restore();
  }
  mainWindow?.focus();
}

if (app.requestSingleInstanceLock()) {
  app.on('web-contents-created', (_event, contents) => {
    hardenWebContents(contents);
  });
  app.on('second-instance', focusMainWindow);
  app.on('window-all-closed', () => {
    app.quit();
  });

  start().catch((error: unknown) => {
    dialog.showErrorBox(
      'DevShare could not start',
      error instanceof Error ? error.message : String(error),
    );
    app.exit(1);
  });
} else {
  // Another DevShare window is already open; it is focused via 'second-instance'.
  app.quit();
}
