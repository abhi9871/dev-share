import { describe, expect, it } from 'vitest';

import { readSecretSetting } from '../src/secrets.js';
import type { DestinationConfig } from '../src/index.js';

const destination: DestinationConfig = {
  name: 'backend',
  type: 'discord',
  settings: { webhookEnv: 'DEVSHARE_BACKEND_WEBHOOK' },
};

describe('readSecretSetting', () => {
  it('reads the secret from the environment variable named by the setting', () => {
    expect(
      readSecretSetting(destination, 'webhookEnv', { DEVSHARE_BACKEND_WEBHOOK: ' secret-value ' }),
    ).toEqual({ variable: 'DEVSHARE_BACKEND_WEBHOOK', value: 'secret-value' });
  });

  it.each([
    ['missing', {}],
    ['not a string', { webhookEnv: 42 }],
    ['blank', { webhookEnv: ' ' }],
  ])('rejects a setting that is %s', (_label, settings) => {
    expect(() => readSecretSetting({ ...destination, settings }, 'webhookEnv', {})).toThrow(
      expect.objectContaining({ code: 'INVALID_DESTINATION' }),
    );
  });

  it.each([
    ['unset', {}],
    ['empty', { DEVSHARE_BACKEND_WEBHOOK: '  ' }],
  ])('reports an environment variable that is %s', (_label, env) => {
    expect(() => readSecretSetting(destination, 'webhookEnv', env)).toThrow(
      expect.objectContaining({ code: 'MISSING_SECRET' }),
    );
  });
});
