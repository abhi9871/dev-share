import type { TransportFactory } from '../transport.js';
import { createDiscordTransportFactory } from './discord.js';

/** Transports DevShare supports out of the box. */
export function createBuiltInTransports(): TransportFactory[] {
  return [createDiscordTransportFactory()];
}
