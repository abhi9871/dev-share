import type { DestinationConfig } from './config.js';
import type { SharePayload } from './payload.js';

/** Environment variables available to transports, typically `process.env`. */
export type Environment = Readonly<Record<string, string | undefined>>;

/** Delivers payloads to one configured destination. */
export interface Transport {
  send(payload: SharePayload): Promise<void>;
}

/** Creates transports for destinations of one `type`, such as `discord`. */
export interface TransportFactory {
  readonly type: string;
  /** Validates the destination's settings and secrets; throws `DevShareError` if invalid. */
  create(destination: DestinationConfig, env: Environment): Transport;
}
