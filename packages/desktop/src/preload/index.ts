import { contextBridge, ipcRenderer } from 'electron';

import { IPC_CHANNELS, type DevShareApi } from '../shared/ipc.js';

function invoke<Method extends keyof DevShareApi>(
  method: Method,
  ...args: Parameters<DevShareApi[Method]>
): ReturnType<DevShareApi[Method]> {
  return ipcRenderer.invoke(IPC_CHANNELS[method], ...args) as ReturnType<DevShareApi[Method]>;
}

// Expose only DevShare's typed API; the renderer gets no direct access to Electron or Node.
const api: DevShareApi = {
  getDestinations: () => invoke('getDestinations'),
  pickFiles: () => invoke('pickFiles'),
  readClipboard: () => invoke('readClipboard'),
  removeAttachment: (id) => invoke('removeAttachment', id),
  share: (request) => invoke('share', request),
};

contextBridge.exposeInMainWorld('devshare', api);
