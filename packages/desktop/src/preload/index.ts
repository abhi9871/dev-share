import { contextBridge, ipcRenderer } from 'electron';

import { IPC_CHANNELS, IPC_EVENTS, type DevShareApi, type DevShareEvents } from '../shared/ipc.js';

function invoke<Method extends keyof DevShareApi>(
  method: Method,
  ...args: Parameters<DevShareApi[Method]>
): ReturnType<DevShareApi[Method]> {
  return ipcRenderer.invoke(IPC_CHANNELS[method], ...args) as ReturnType<DevShareApi[Method]>;
}

/** Subscribes to a notification. The IPC event itself is not passed on to the renderer. */
function subscribe(channel: string, listener: () => void): () => void {
  const onMessage = () => {
    listener();
  };
  ipcRenderer.on(channel, onMessage);
  return () => {
    ipcRenderer.removeListener(channel, onMessage);
  };
}

// Expose only DevShare's typed API; the renderer gets no direct access to Electron or Node.
const api: DevShareApi & DevShareEvents = {
  getDestinations: () => invoke('getDestinations'),
  pickFiles: () => invoke('pickFiles'),
  readClipboard: () => invoke('readClipboard'),
  removeAttachment: (id) => invoke('removeAttachment', id),
  share: (request) => invoke('share', request),
  onSummoned: (listener) => subscribe(IPC_EVENTS.onSummoned, listener),
};

contextBridge.exposeInMainWorld('devshare', api);
