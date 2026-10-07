import { fileURLToPath } from 'node:url';

import { app, BrowserWindow } from 'electron';

// Unpacked from the installed app archive (see electron-builder.yml), like the tray icon.
import appIconPath from '../../resources/icon.png?asset&asarUnpack';

/** Set by electron-vite while running `electron-vite dev`. */
const DEV_SERVER_URL_ENV = 'ELECTRON_RENDERER_URL';

/** `showWhenReady` is false when DevShare starts hidden in the tray. */
export function createMainWindow(showWhenReady: boolean): BrowserWindow {
  const window = new BrowserWindow({
    title: 'DevShare',
    width: 560,
    height: 640,
    minWidth: 420,
    minHeight: 480,
    show: false,
    icon: appIconPath,
    autoHideMenuBar: true,
    webPreferences: {
      preload: fileURLToPath(new URL('../preload/index.cjs', import.meta.url)),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });
  if (showWhenReady) {
    window.once('ready-to-show', () => {
      window.show();
    });
  }
  return window;
}

/** Loads the renderer from the dev server in development, or from the built files. */
export function loadRenderer(window: BrowserWindow): Promise<void> {
  const devServerUrl = process.env[DEV_SERVER_URL_ENV];
  if (!app.isPackaged && devServerUrl) {
    return window.loadURL(devServerUrl);
  }
  return window.loadFile(fileURLToPath(new URL('../renderer/index.html', import.meta.url)));
}
