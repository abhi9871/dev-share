import { describe, expect, it, vi } from 'vitest';

import {
  createSharePayload,
  DevShareError,
  SharingService,
  type DestinationConfig,
  type DevShareConfig,
  type Environment,
  type SharePayload,
  type TransportFactory,
} from '../src/index.js';

const general: DestinationConfig = { name: 'General', type: 'fake', settings: {} };
const backend: DestinationConfig = { name: 'Backend', type: 'fake', settings: {} };
const config: DevShareConfig = { defaultDestination: 'General', destinations: [general, backend] };
const payload = createSharePayload({ text: 'Please check this' });

/** Records which destination each payload was sent to. */
function fakeTransport(type = 'fake') {
  const sent: { destination: string; payload: SharePayload; env: Environment }[] = [];
  const factory: TransportFactory = {
    type,
    create: (destination, env) => ({
      send: (p) => {
        sent.push({ destination: destination.name, payload: p, env });
        return Promise.resolve();
      },
    }),
  };
  return { factory, sent };
}

describe('SharingService', () => {
  it('sends the payload to the named destination through its transport', async () => {
    const { factory, sent } = fakeTransport();
    const env = { SOME_SECRET: 'value' };
    const service = new SharingService({ config, env, transports: [factory] });

    const result = await service.share(payload, 'backend');

    expect(result).toEqual({ destination: 'Backend' });
    expect(sent).toEqual([{ destination: 'Backend', payload, env }]);
  });

  it('uses the default destination when none is named', async () => {
    const { factory, sent } = fakeTransport();
    const service = new SharingService({ config, env: {}, transports: [factory] });

    await expect(service.share(payload)).resolves.toEqual({ destination: 'General' });
    expect(sent.map((s) => s.destination)).toEqual(['General']);
  });

  it('matches destination types case-insensitively', async () => {
    const { factory, sent } = fakeTransport('FAKE');
    const service = new SharingService({ config, env: {}, transports: [factory] });

    await service.share(payload);

    expect(sent).toHaveLength(1);
  });

  it('reports an unknown destination without sending', async () => {
    const { factory, sent } = fakeTransport();
    const service = new SharingService({ config, env: {}, transports: [factory] });

    await expect(service.share(payload, 'Bugs')).rejects.toMatchObject({
      code: 'DESTINATION_NOT_FOUND',
    });
    expect(sent).toEqual([]);
  });

  it('reports a destination whose type has no transport', async () => {
    const { factory } = fakeTransport('other');
    const service = new SharingService({ config, env: {}, transports: [factory] });

    await expect(service.share(payload)).rejects.toMatchObject({
      code: 'UNSUPPORTED_DESTINATION_TYPE',
      message: 'Destination "General" uses unsupported type "fake". Supported: other.',
    });
  });

  it('propagates transport failures', async () => {
    const failure = new DevShareError('DESTINATION_REJECTED', 'rejected');
    const factory: TransportFactory = {
      type: 'fake',
      create: () => ({ send: vi.fn(() => Promise.reject(failure)) }),
    };
    const service = new SharingService({ config, env: {}, transports: [factory] });

    await expect(service.share(payload)).rejects.toBe(failure);
  });
});
