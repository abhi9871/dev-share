import { DevShareError, type SharingService } from '@devshare/core';

import type { DevShareApi, IpcError, IpcResult } from '../shared/ipc.js';

export interface IpcHandlerDependencies {
  /** Loads the user's current configuration; called per request so config edits apply. */
  readonly loadSharingService: () => Promise<Pick<SharingService, 'listDestinations'>>;
}

/**
 * Main-process implementation of each API method. Handlers receive renderer input as
 * `unknown` and must validate it, because the renderer is untrusted.
 */
export type IpcHandlers = {
  readonly [Method in keyof DevShareApi]: (input: unknown) => ReturnType<DevShareApi[Method]>;
};

export function createIpcHandlers(deps: IpcHandlerDependencies): IpcHandlers {
  return {
    getDestinations: () =>
      toResult(async () => {
        const { destinations, defaultDestination } = (
          await deps.loadSharingService()
        ).listDestinations();
        return { destinations, defaultDestination };
      }),
  };
}

/** Runs an action and converts failures into a serializable error for the renderer. */
async function toResult<T>(action: () => Promise<T>): Promise<IpcResult<T>> {
  try {
    return { ok: true, value: await action() };
  } catch (error) {
    return { ok: false, error: toIpcError(error) };
  }
}

function toIpcError(error: unknown): IpcError {
  if (error instanceof DevShareError) {
    return { code: error.code, message: error.message };
  }
  return {
    code: 'UNEXPECTED',
    message: `Unexpected error: ${error instanceof Error ? error.message : String(error)}`,
  };
}
