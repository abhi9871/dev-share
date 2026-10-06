import { defaultDestination, resolveDestination, type DevShareConfig } from './config.js';
import { DevShareError } from './errors.js';
import type { SharePayload } from './payload.js';
import type { Environment, TransportFactory } from './transport.js';

export interface SharingServiceOptions {
  readonly config: DevShareConfig;
  readonly env: Environment;
  /** Transports available for destinations, matched by destination `type`. */
  readonly transports: readonly TransportFactory[];
}

/** What interfaces may show about destinations: names and types, never settings or secrets. */
export interface DestinationList {
  readonly destinations: readonly { readonly name: string; readonly type: string }[];
  /** Destination used when none is chosen, if there is one. */
  readonly defaultDestination: string | undefined;
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

  listDestinations(): DestinationList {
    return {
      destinations: this.#config.destinations.map(({ name, type }) => ({ name, type })),
      defaultDestination: defaultDestination(this.#config)?.name,
    };
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
