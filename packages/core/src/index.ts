export { mediaTypeForFileName, readFileAttachment } from './attachments.js';
export {
  loadConfig,
  resolveDestination,
  type DestinationConfig,
  type DevShareConfig,
} from './config.js';
export { CONFIG_PATH_ENV, resolveConfigPath, type ConfigPathOptions } from './config-path.js';
export { DevShareError, type DevShareErrorCode } from './errors.js';
export {
  createSharePayload,
  type Attachment,
  type SharePayload,
  type SharePayloadInput,
} from './payload.js';
export { SharingService, type ShareResult, type SharingServiceOptions } from './sharing-service.js';
export type { Environment, Transport, TransportFactory } from './transport.js';
export { createBuiltInTransports } from './transports/index.js';
