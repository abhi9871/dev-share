import { dirname, join } from 'node:path';

import { loadLocalSharingService, resolveConfigPath } from '@devshare/core';
import { app, dialog, session, type BrowserWindow, type Tray } from 'electron';

import { IPC_EVENTS } from '../shared/ipc.js';
import { shortcutLabel } from '../shared/shortcuts.js';
import { AttachmentStore } from './attachment-store.js';
import { hideOnClose, showWindow } from './background.js';
import { readSystemClipboard } from './clipboard.js';
import { readAttachmentWithinLimit } from './files.js';
import { registerIpcHandlers } from './ipc.js';
import { createIpcHandlers } from './ipc-handlers.js';
import { electronLoginItem, START_IN_TRAY_ARG } from './login-item.js';
import { PreferencesFile } from './preferences.js';
import { PreferencesService } from './preferences-service.js';
import { denyPermissionRequests, hardenWebContents } from './security.js';
import { electronShortcuts, unregisterShortcuts } from './shortcut.js';
import {
  createTray,
  showShortcutUnavailableNotice,
  showStillRunningNotice,
  updateTrayShortcut,
} from './tray.js';
import { createMainWindow, loadRenderer } from './window.js';

let mainWindow: BrowserWindow | undefined;
// Held for the app's lifetime; a tray that is garbage-collected disappears.
let tray: Tray | undefined;

/** Desktop preferences live next to `config.json`, with the rest of the user's setup. */
const PREFERENCES_FILE_NAME = 'desktop.json';

async function start(): Promise<void> {
  await app.whenReady();
  denyPermissionRequests(session.defaultSession);

  const startedInTray = process.argv.includes(START_IN_TRAY_ARG);
  const window = createMainWindow(!startedInTray);
  mainWindow = window;
  const preferences = await PreferencesService.start({
    file: new PreferencesFile(join(dirname(resolveConfigPath()), PREFERENCES_FILE_NAME)),
    shortcuts: electronShortcuts,
    loginItem: electronLoginItem,
    onShortcut: summonMainWindow,
  });
  /** Label of the global shortcut, if it is registered. */
  const activeShortcut = () => {
    const { shortcut, shortcutActive } = preferences.view();
    return shortcutActive ? shortcutLabel(shortcut) : undefined;
  };

  const appTray = createTray(
    {
      open: summonMainWindow,
      quit: () => {
        app.quit();
      },
    },
    activeShortcut(),
  );
  tray = appTray;
  if (!preferences.view().shortcutActive) {
    showShortcutUnavailableNotice(appTray, shortcutLabel(preferences.view().shortcut));
  }
  app.on(
    'before-quit',
    hideOnClose(window, () => {
      showStillRunningNotice(appTray, activeShortcut());
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
      preferences: {
        view: () => preferences.view(),
        update: async (input) => {
          const view = await preferences.update(input);
          updateTrayShortcut(appTray, activeShortcut());
          return view;
        },
      },
      launchState: { startedInTray },
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
