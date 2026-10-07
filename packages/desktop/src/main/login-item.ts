import { app } from 'electron';

import type { PreferencesServiceDependencies } from './preferences-service.js';

/** Command-line flag that starts DevShare hidden in the tray, used when Windows starts it. */
export const START_IN_TRAY_ARG = '--start-in-tray';

/** Registry value name of the sign-in entry, shared by installed, portable, and dev builds. */
const LOGIN_ITEM_NAME = 'DevShare';

/**
 * Set by the portable build to the location of DevShare-Portable.exe. Each run unpacks the
 * app into a temporary folder, so `process.execPath` must not be used for the sign-in entry.
 */
const PORTABLE_EXECUTABLE_ENV = 'PORTABLE_EXECUTABLE_FILE';

/**
 * How Windows runs DevShare at sign-in. An unpackaged (dev) build runs this repository's
 * Electron with the app folder, so moving the repository breaks that entry.
 */
function loginCommand(): { path: string; args: string[] } {
  const path = process.env[PORTABLE_EXECUTABLE_ENV] ?? process.execPath;
  const args = app.isPackaged ? [START_IN_TRAY_ARG] : [app.getAppPath(), START_IN_TRAY_ARG];
  return { path, args };
}

export const electronLoginItem: PreferencesServiceDependencies['loginItem'] = {
  // Windows matches the entry by command, so an entry left by another copy shows as off.
  isEnabled: () => app.getLoginItemSettings(loginCommand()).openAtLogin,
  setEnabled: (enabled) => {
    app.setLoginItemSettings({ ...loginCommand(), name: LOGIN_ITEM_NAME, openAtLogin: enabled });
  },
};
