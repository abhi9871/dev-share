import { app } from 'electron';

import type { PreferencesServiceDependencies } from './preferences-service.js';

/** Command-line flag that starts DevShare hidden in the tray, used when Windows starts it. */
export const START_IN_TRAY_ARG = '--start-in-tray';

/**
 * Runs DevShare when the user signs in to Windows. Until DevShare is packaged, Windows starts
 * this repository's Electron with the app folder, so moving the repository breaks the entry.
 */
function loginCommand(): { path: string; args: string[] } {
  const args = app.isPackaged ? [START_IN_TRAY_ARG] : [app.getAppPath(), START_IN_TRAY_ARG];
  return { path: process.execPath, args };
}

export const electronLoginItem: PreferencesServiceDependencies['loginItem'] = {
  isEnabled: () => app.getLoginItemSettings(loginCommand()).openAtLogin,
  setEnabled: (enabled) => {
    app.setLoginItemSettings({ ...loginCommand(), openAtLogin: enabled });
  },
};
