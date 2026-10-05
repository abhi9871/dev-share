import { resolveDestination, type DevShareConfig } from './config.js';
import { DevShareError } from './errors.js';
import type { SharePayload } from './payload.js';
import type { Environment, TransportFactory } from './transport.js';

export interface SharingServiceOptions {
  readonly config: DevShareConfig;
  readonly env: Environment;
  /** Transports available for destinations, matched by destination `type`. */
  readonly transports: readonly TransportFactory[];
}

export interface ShareResult {
  /** Name of the destination the payload was delivered to. */
  readonly destination: string;
}

/** Sends payloads to configured destinations through the matching transport. */
export class SharingService {
  readonly #config: DevShareConfig;
  readonly #env: Environment;
  readonly #transports: ReadonlyMap<string, TransportFactory>;

  constructor(options: SharingServiceOptions) {
    this.#config = options.config;
    this.#env = options.env;
    this.#transports = new Map(options.transports.map((t) => [t.type.toLowerCase(), t]));
  }

  /** Shares to the named destination, or to the default one when no name is given. */
  async share(payload: SharePayload, destinationName?: string): Promise<ShareResult> {
    const destination = resolveDestination(this.#config, destinationName);
    const factory = this.#transports.get(destination.type.toLowerCase());
    if (!factory) {
      const supported = [...this.#transports.values()].map((t) => t.type).join(', ');
      throw new DevShareError(
        'UNSUPPORTED_DESTINATION_TYPE',
        `Destination "${destination.name}" uses unsupported type "${destination.type}". Supported: ${supported}.`,
      );
    }

    await factory.create(destination, this.#env).send(payload);
    return { destination: destination.name };
  }
}
