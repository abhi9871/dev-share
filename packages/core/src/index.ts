export { mediaTypeForFileName, readFileAttachment } from './attachments.js';
export {
  loadConfig,
  resolveDestination,
  saveConfig,
  type DestinationConfig,
  type DevShareConfig,
} from './config.js';
export { resolveConfigPath, type ConfigPathOptions } from './config-path.js';
export { readEnvFile, updateEnvFile } from './env-file.js';
export { DevShareError, type DevShareErrorCode } from './errors.js';
export { envFilePathFor, loadLocalSharingService, type LocalSetupOptions } from './local-setup.js';
export {
  createSharePayload,
  type Attachment,
  type SharePayload,
  type SharePayloadInput,
} from './payload.js';
export {
  SharingService,
  type DestinationList,
  type ShareResult,
  type SharingServiceOptions,
} from './sharing-service.js';
export { stripByteOrderMark } from './text.js';
export type { Environment, Transport, TransportFactory } from './transport.js';
export { createBuiltInTransports } from './transports/index.js';
export { DISCORD_TRANSPORT_TYPE, isDiscordWebhookUrl } from './transports/discord.js';
