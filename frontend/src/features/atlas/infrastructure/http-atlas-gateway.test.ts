import axios, { AxiosError, type AxiosAdapter, type AxiosResponse } from 'axios';
import { describe, expect, it } from 'vitest';
import { AppError } from '@/shared/application/app-error';
import { SpecIdExistsError } from '../application/spec-id-exists-error';
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
  params?: unknown;
}

function gatewayAnswering(status: number, data: unknown, sent: Sent[] = []): HttpAtlasGateway {
  const adapter: AxiosAdapter = async (config) => {
    sent.push({
      method: config.method,
      url: config.url,
      body: config.data === undefined ? undefined : JSON.parse(config.data as string),
      params: config.params,
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

const FACTS = { productType: 'BLD', material: 'APS', topDiameter: { value: '90', unit: 'mm' } };

const wireSaved = {
  ...wireDecoded,
  name: 'Illustrative lid',
  savedBy: { id: '00000000-0000-4000-8000-0000000000aa', fullName: 'Ada Invented' },
  savedAt: '2026-10-16T08:00:00.000Z',
};

describe('HttpAtlasGateway, building and saving', () => {
  it('sends the facts to encode and returns the code built from them', async () => {
    const sent: Sent[] = [];
    const encoded = await gatewayAnswering(200, { data: wireDecoded }, sent).encode(FACTS);
    expect(sent).toEqual([{ method: 'post', url: '/atlas/spec-ids/encode', body: { facts: FACTS } }]);
    expect(encoded).toEqual(wireDecoded);
  });

  it('rejects refused facts with an AppError whose fields name each slot', async () => {
    const fields = { height: ['Height: 12000 mm is outside 1–9999 mm.'] };
    const gateway = gatewayAnswering(400, {
      error: { code: 'INVALID_SPEC_ID', message: 'The Spec ID is not valid.', details: { fields } },
    });
    const failure = await gateway.encode(FACTS).catch((error: unknown) => error);
    expect((failure as AppError).code).toBe('INVALID_SPEC_ID');
    expect((failure as AppError).fields).toEqual(fields);
  });

  it('sends the name and facts to save and returns the saved Spec ID with its date as a Date', async () => {
    const sent: Sent[] = [];
    const saved = await gatewayAnswering(201, { data: wireSaved }, sent).save({ name: 'Illustrative lid', facts: FACTS });
    expect(sent).toEqual([
      { method: 'post', url: '/atlas/spec-ids', body: { name: 'Illustrative lid', facts: FACTS } },
    ]);
    expect(saved.name).toBe('Illustrative lid');
    expect(saved.savedBy).toEqual({ id: '00000000-0000-4000-8000-0000000000aa', fullName: 'Ada Invented' });
    expect(saved.savedAt).toEqual(new Date('2026-10-16T08:00:00.000Z'));
    expect(saved.slots).toEqual(wireDecoded.slots);
  });

  it('rejects a duplicate with a SpecIdExistsError carrying the Spec ID already saved', async () => {
    const gateway = gatewayAnswering(409, {
      error: {
        code: 'SPEC_ID_EXISTS',
        message: 'This Spec ID already exists. Nothing new was saved.',
        details: { existing: wireSaved },
      },
    });

    const failure = await gateway.save({ name: 'Second', facts: FACTS }).catch((error: unknown) => error);

    expect(failure).toBeInstanceOf(SpecIdExistsError);
    expect(failure).toBeInstanceOf(AppError);
    const exists = failure as SpecIdExistsError;
    expect(exists.code).toBe('SPEC_ID_EXISTS');
    expect(exists.message).toBe('This Spec ID already exists. Nothing new was saved.');
    expect(exists.existing.name).toBe('Illustrative lid');
    expect(exists.existing.savedAt).toEqual(new Date('2026-10-16T08:00:00.000Z'));
  });

  it('rejects a save refused for its name and slots with an AppError carrying both', async () => {
    const fields = { name: ['Name is required.'], height: ['Height: 0 mm is outside 1–9999 mm.'] };
    const gateway = gatewayAnswering(400, {
      error: { code: 'INVALID_SPEC_ID', message: 'The Spec ID is not valid.', details: { fields } },
    });
    const failure = await gateway.save({ name: '', facts: FACTS }).catch((error: unknown) => error);
    expect(failure).not.toBeInstanceOf(SpecIdExistsError);
    expect((failure as AppError).fields).toEqual(fields);
  });

  it('rejects a save without a session with SIGN_IN_REQUIRED', async () => {
    const gateway = gatewayAnswering(401, {
      error: { code: 'SIGN_IN_REQUIRED', message: 'Your session ended. Sign in again.' },
    });
    const failure = await gateway.save({ name: 'x', facts: FACTS }).catch((error: unknown) => error);
    expect((failure as AppError).code).toBe('SIGN_IN_REQUIRED');
  });
});

describe('HttpAtlasGateway, looking up', () => {
  it('finds a saved Spec ID by its code, encoded for the address', async () => {
    const sent: Sent[] = [];
    const found = await gatewayAnswering(200, { data: wireSaved }, sent).findByCode(`${ILLUSTRATIVE} /?`);
    expect(sent).toEqual([
      { method: 'get', url: `/atlas/spec-ids/${encodeURIComponent(`${ILLUSTRATIVE} /?`)}`, body: undefined },
    ]);
    expect(found.name).toBe('Illustrative lid');
  });

  it('rejects a code nobody saved with SPEC_ID_NOT_FOUND', async () => {
    const gateway = gatewayAnswering(404, {
      error: { code: 'SPEC_ID_NOT_FOUND', message: 'No saved Spec ID has this code. Check it, or build and save it.' },
    });
    const failure = await gateway.findByCode(ILLUSTRATIVE).catch((error: unknown) => error);
    expect((failure as AppError).code).toBe('SPEC_ID_NOT_FOUND');
    expect((failure as AppError).message).toBe('No saved Spec ID has this code. Check it, or build and save it.');
  });

  it('passes the slots chosen as the query and returns both groups', async () => {
    const sent: Sent[] = [];
    const similar = await gatewayAnswering(200, { data: { fits: [wireSaved], mightFit: [] } }, sent).findSimilar({
      topDiameter: '0090',
    });
    expect(sent).toEqual([
      { method: 'get', url: '/atlas/spec-ids', body: undefined, params: { topDiameter: '0090' } },
    ]);
    expect(similar.fits.map((saved) => saved.name)).toEqual(['Illustrative lid']);
    expect(similar.fits[0]?.savedAt).toEqual(new Date('2026-10-16T08:00:00.000Z'));
    expect(similar.mightFit).toEqual([]);
  });

  it('rejects a refused lookup with an AppError whose fields name each slot', async () => {
    const fields = { colour: ['Not a slot of an S1 Spec ID.'] };
    const gateway = gatewayAnswering(400, {
      error: { code: 'VALIDATION_FAILED', message: 'The lookup is not valid.', details: { fields } },
    });
    const failure = await gateway.findSimilar({}).catch((error: unknown) => error);
    expect((failure as AppError).code).toBe('VALIDATION_FAILED');
    expect((failure as AppError).fields).toEqual(fields);
  });
});
