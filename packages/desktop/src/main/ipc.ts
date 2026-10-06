import { ipcMain, type IpcMainInvokeEvent } from 'electron';

import { IPC_CHANNELS, type DevShareApi, type IpcResult } from '../shared/ipc.js';
import type { IpcHandlers } from './ipc-handlers.js';

const UNTRUSTED_SENDER: IpcResult<never> = {
  ok: false,
  error: { code: 'UNTRUSTED_SENDER', message: 'Request rejected.' },
};

/** Registers every API method, accepting requests only from trusted senders. */
export function registerIpcHandlers(
  handlers: IpcHandlers,
  isTrustedSender: (event: IpcMainInvokeEvent) => boolean,
): void {
  for (const method of Object.keys(IPC_CHANNELS) as (keyof DevShareApi)[]) {
    ipcMain.handle(IPC_CHANNELS[method], (event, input: unknown) =>
      isTrustedSender(event) ? handlers[method](input) : UNTRUSTED_SENDER,
    );
  }
}
