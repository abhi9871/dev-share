import { Menu, nativeImage, Tray } from 'electron';

// Electron picks up the high-DPI tray-icon@2x.png next to this file automatically.
import trayIconPath from '../../resources/tray-icon.png?asset';
import { trayMenuTemplate, type TrayActions } from './background.js';

export function createTray(actions: TrayActions): Tray {
  const tray = new Tray(nativeImage.createFromPath(trayIconPath));
  tray.setToolTip('DevShare');
  tray.setContextMenu(Menu.buildFromTemplate(trayMenuTemplate(actions)));
  tray.on('click', actions.open);
  return tray;
}

/** Tells the user, once, that closing the window left DevShare running in the tray. */
export function showStillRunningNotice(tray: Tray): void {
  tray.displayBalloon({
    title: 'DevShare is still running',
    content: 'Open it again from the tray icon, or quit from the icon’s menu.',
  });
}
