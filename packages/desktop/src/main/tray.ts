import { Menu, nativeImage, Tray } from 'electron';

// Electron picks up the high-DPI tray-icon@2x.png next to this file automatically.
import trayIconPath from '../../resources/tray-icon.png?asset';
import { trayMenuTemplate, type TrayActions } from './background.js';

/** `shortcut` is the label of the global shortcut, if it is registered. */
export function createTray(actions: TrayActions, shortcut: string | undefined): Tray {
  const tray = new Tray(nativeImage.createFromPath(trayIconPath));
  tray.setToolTip(shortcut ? `DevShare (${shortcut})` : 'DevShare');
  tray.setContextMenu(Menu.buildFromTemplate(trayMenuTemplate(actions)));
  tray.on('click', actions.open);
  return tray;
}

/** Tells the user, once, that closing the window left DevShare running in the tray. */
export function showStillRunningNotice(tray: Tray, shortcut: string | undefined): void {
  const open = shortcut ? `Press ${shortcut} or click the tray icon` : 'Click the tray icon';
  tray.displayBalloon({
    title: 'DevShare is still running',
    content: `${open} to open it again; quit from the icon’s menu.`,
  });
}

/** Explains that the global shortcut is unavailable because another app already uses it. */
export function showShortcutUnavailableNotice(tray: Tray, shortcut: string): void {
  tray.displayBalloon({
    title: `${shortcut} is not available`,
    content: `Another app is already using ${shortcut}. Open DevShare from the tray icon instead.`,
  });
}
