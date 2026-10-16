import axios, { AxiosError, type AxiosAdapter, type AxiosResponse } from 'axios';
import { describe, expect, it } from 'vitest';
import { AppError } from '@/shared/application/app-error';
import { HttpAtlasGateway } from './http-atlas-gateway';

const ILLUSTRATIVE = 'S1.BLD.APS.00.CL.RD.DM.XXXXX.0090.XXXX.0000.XXXX.XXXX.XXXX.0033.XXX.000.XX';

const wireDictionary = {
  release: 'S1 0.1.0',
  approvedOn: '2026-10-16',
  slots: [{ key: 'productType', name: 'Product type', values: [{ code: 'BLD', meaning: 'Bowl lid' }] }],
  rules: [{ productType: 'BLD', slot: 'capacity', rule: 'never' }],
};

const wireDecoded = {
  code: ILLUSTRATIVE,
  dictionaryRelease: 'S1 0.1.0',
  slots: [{ number: 2, key: 'productType', name: 'Product type', raw: 'BLD', state: 'value', meaning: 'Bowl lid' }],
};

interface Sent {
  method: string | undefined;
  url: string | undefined;
  body: unknown;
}

function gatewayAnswering(status: number, data: unknown, sent: Sent[] = []): HttpAtlasGateway {
  const adapter: AxiosAdapter = async (config) => {
    sent.push({
      method: config.method,
      url: config.url,
      body: config.data === undefined ? undefined : JSON.parse(config.data as string),
    });
    const response: AxiosResponse = { data, status, statusText: String(status), headers: {}, config };
    if (status >= 400) throw new AxiosError('Request failed', 'ERR_BAD_RESPONSE', config, null, response);
    return response;
  };
  return new HttpAtlasGateway(axios.create({ adapter }));
}

describe('HttpAtlasGateway', () => {
  it('reads the dictionary', async () => {
    const sent: Sent[] = [];
    const dictionary = await gatewayAnswering(200, { data: wireDictionary }, sent).dictionary();
    expect(sent).toEqual([{ method: 'get', url: '/atlas/dictionary', body: undefined }]);
    expect(dictionary).toEqual(wireDictionary);
  });

  it('sends the code to decode and returns its slots', async () => {
    const sent: Sent[] = [];
    const decoded = await gatewayAnswering(200, { data: wireDecoded }, sent).decode(ILLUSTRATIVE);
    expect(sent).toEqual([{ method: 'post', url: '/atlas/spec-ids/decode', body: { code: ILLUSTRATIVE } }]);
    expect(decoded).toEqual(wireDecoded);
  });

  it("rejects an invalid code with an AppError whose fields carry each slot's messages", async () => {
    const fields = {
      code: ['A Spec ID is 74 characters. This one has 73.'],
      topDiameter: ['Top diameter: 090 must be 4 characters.'],
    };
    const gateway = gatewayAnswering(400, {
      error: { code: 'INVALID_SPEC_ID', message: 'The Spec ID is not valid.', details: { fields } },
    });

    const failure = await gateway.decode('S1.BLD').catch((error: unknown) => error);
    expect(failure).toBeInstanceOf(AppError);
    expect((failure as AppError).code).toBe('INVALID_SPEC_ID');
    expect((failure as AppError).message).toBe('The Spec ID is not valid.');
    expect((failure as AppError).fields).toEqual(fields);
  });

  it('rejects with SIGN_IN_REQUIRED when the session has ended', async () => {
    const gateway = gatewayAnswering(401, {
      error: { code: 'SIGN_IN_REQUIRED', message: 'Your session ended. Sign in again.' },
    });
    const failure = await gateway.dictionary().catch((error: unknown) => error);
    expect((failure as AppError).code).toBe('SIGN_IN_REQUIRED');
  });

  it('rejects with NETWORK when the server cannot be reached', async () => {
    const adapter: AxiosAdapter = async (config) => {
      throw new AxiosError('Network Error', 'ERR_NETWORK', config);
    };
    const gateway = new HttpAtlasGateway(axios.create({ adapter }));
    const failure = await gateway.decode(ILLUSTRATIVE).catch((error: unknown) => error);
    expect((failure as AppError).code).toBe('NETWORK');
  });
});
