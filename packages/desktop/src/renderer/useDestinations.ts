import { useEffect, useState } from 'react';

import type { DestinationsView, IpcError } from '../shared/ipc.js';

export type DestinationsState =
  | { readonly status: 'loading' }
  | { readonly status: 'error'; readonly error: IpcError }
  | { readonly status: 'ready'; readonly value: DestinationsView };

/** Loads the configured destinations from the main process. */
export function useDestinations(): DestinationsState {
  const [state, setState] = useState<DestinationsState>({ status: 'loading' });

  useEffect(() => {
    let active = true;
    void window.devshare.getDestinations().then((result) => {
      if (active) {
        setState(
          result.ok
            ? { status: 'ready', value: result.value }
            : { status: 'error', error: result.error },
        );
      }
    });
    return () => {
      active = false;
    };
  }, []);

  return state;
}
