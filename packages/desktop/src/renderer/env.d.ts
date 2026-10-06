/// <reference types="vite/client" />

import type { DevShareApi } from '../shared/ipc.js';

declare global {
  interface Window {
    /** Exposed by the preload script; the renderer's only access to the main process. */
    readonly devshare: DevShareApi;
  }
}
