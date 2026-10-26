import axios, { AxiosError, type AxiosAdapter, type AxiosResponse } from 'axios';
import { describe, expect, it } from 'vitest';
import { AppError } from '@/shared/application/app-error';
import { SpecIdChangedError } from '../application/spec-id-changed-error';
import { SpecIdExistsError } from '../application/spec-id-exists-error';
import { HttpAtlasGateway } from './http-atlas-gateway';

const ILLUSTRATIVE = 'BLD.APS.Y.CL.RD.DM.X.0090.X.Y.X.X.X.0033.X.Y.X.Y.X.X.X.X.X.X.X';

const wireDictionary = {
  release: 'S2 0.1.0',
  approvedOn: '2026-10-16',
  slots: [{ key: 'productType', name: 'Product type', values: [{ code: 'BLD', meaning: 'Bowl lid' }] }],
  rules: [{ productType: 'BLD', slot: 'capacity', rule: 'never' }],
};

const wireDecoded = {
  code: ILLUSTRATIVE,
  dictionaryRelease: 'S2 0.1.0',
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
      productType: ['Product type: QQQ is not in the dictionary.'],
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

const SPEC_ID = '00000000-0000-4000-8000-000000000001';

const wireSaved = {
  ...wireDecoded,
  id: SPEC_ID,
  name: 'Illustrative lid',
  savedBy: { id: '00000000-0000-4000-8000-0000000000aa', fullName: 'Ada Invented' },
  savedAt: '2026-10-16T08:00:00.000Z',
  version: 1,
  updatedBy: null,
  updatedAt: null,
};

const wireLookup = { ...wireSaved, replacedCode: null, formerHolders: [] };

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
    const found = await gatewayAnswering(200, { data: wireLookup }, sent).findByCode(`${ILLUSTRATIVE} /?`);
    expect(sent).toEqual([
      { method: 'get', url: `/atlas/spec-ids/${encodeURIComponent(`${ILLUSTRATIVE} /?`)}`, body: undefined },
    ]);
    expect(found.name).toBe('Illustrative lid');
    expect(found.replacedCode).toBeNull();
  });

  it('answers the Spec ID a replaced code became, with every former holder and its date as a Date', async () => {
    const formerHolders = [
      { id: '00000000-0000-4000-8000-000000000002', name: 'Old lid', code: 'S1.OTHER', until: '2026-10-17T09:30:00.000Z' },
    ];
    const gateway = gatewayAnswering(200, { data: { ...wireLookup, replacedCode: ILLUSTRATIVE, formerHolders } });
    const found = await gateway.findByCode(ILLUSTRATIVE);
    expect(found.replacedCode).toBe(ILLUSTRATIVE);
    expect(found.formerHolders).toEqual([{ ...formerHolders[0], until: new Date('2026-10-17T09:30:00.000Z') }]);
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
    const fields = { colour: ['Not a slot of a Spec ID.'] };
    const gateway = gatewayAnswering(400, {
      error: { code: 'VALIDATION_FAILED', message: 'The lookup is not valid.', details: { fields } },
    });
    const failure = await gateway.findSimilar({}).catch((error: unknown) => error);
    expect((failure as AppError).code).toBe('VALIDATION_FAILED');
    expect((failure as AppError).fields).toEqual(fields);
  });
});

describe('HttpAtlasGateway, reading raw text', () => {
  const wireReading = {
    read: [{ key: 'productType', name: 'Product type', meaning: 'Bowl lid', words: 'Lid', ruling: null }],
    ignored: ['for', 'Cava'],
    conflicts: [{ key: 'material', name: 'Material', found: ['PET', 'PP'] }],
    decoded: wireDecoded,
  };

  it('sends the text and the product type, and returns the reading with its code', async () => {
    const sent: Sent[] = [];
    const reading = await gatewayAnswering(200, { data: wireReading }, sent).readText({
      text: 'Lid for Cava',
      productType: 'BLD',
    });
    expect(sent).toEqual([
      { method: 'post', url: '/atlas/spec-ids/read', body: { text: 'Lid for Cava', productType: 'BLD' } },
    ]);
    expect(reading).toEqual(wireReading);
  });

  it('sends the text alone when no product type is given, and keeps a missing code as null', async () => {
    const sent: Sent[] = [];
    const reading = await gatewayAnswering(200, { data: { ...wireReading, decoded: null } }, sent).readText({
      text: 'PET and PP',
    });
    expect(sent).toEqual([{ method: 'post', url: '/atlas/spec-ids/read', body: { text: 'PET and PP' } }]);
    expect(reading.decoded).toBeNull();
  });

  it('rejects refused text with an AppError whose fields carry the message for the box', async () => {
    const fields = { text: ['Search text must be at most 500 characters.'] };
    const gateway = gatewayAnswering(400, {
      error: { code: 'VALIDATION_FAILED', message: 'The lookup is not valid.', details: { fields } },
    });
    const failure = await gateway.readText({ text: 'x'.repeat(501) }).catch((error: unknown) => error);
    expect(failure).toBeInstanceOf(AppError);
    expect((failure as AppError).code).toBe('VALIDATION_FAILED');
    expect((failure as AppError).fields).toEqual(fields);
  });
});

describe('HttpAtlasGateway, changing a saved Spec ID', () => {
  const ben = { id: '00000000-0000-4000-8000-0000000000bb', fullName: 'Ben Invented' };

  it('opens a saved Spec ID by its id, with who last changed it and when', async () => {
    const sent: Sent[] = [];
    const wire = { ...wireSaved, version: 3, updatedBy: ben, updatedAt: '2026-10-17T14:32:00.000Z' };
    const saved = await gatewayAnswering(200, { data: wire }, sent).getSaved(SPEC_ID);
    expect(sent).toEqual([{ method: 'get', url: `/atlas/saved/${SPEC_ID}`, body: undefined }]);
    expect(saved.id).toBe(SPEC_ID);
    expect(saved.version).toBe(3);
    expect(saved.updatedBy).toEqual(ben);
    expect(saved.updatedAt).toEqual(new Date('2026-10-17T14:32:00.000Z'));
  });

  it('reads a Spec ID never changed with no one and no date for its last change', async () => {
    const saved = await gatewayAnswering(200, { data: wireSaved }).getSaved(SPEC_ID);
    expect(saved.updatedBy).toBeNull();
    expect(saved.updatedAt).toBeNull();
  });

  it('sends the name, facts and version it started from', async () => {
    const sent: Sent[] = [];
    await gatewayAnswering(200, { data: wireSaved }, sent).update(SPEC_ID, { name: 'Lid', facts: FACTS, version: 2 });
    expect(sent).toEqual([
      { method: 'patch', url: `/atlas/saved/${SPEC_ID}`, body: { name: 'Lid', facts: FACTS, version: 2 } },
    ]);
  });

  it('rejects a change someone saved first with a SpecIdChangedError', async () => {
    const message = 'Someone changed this Spec ID while you were editing. Reload to see their changes, then make yours again.';
    const gateway = gatewayAnswering(409, { error: { code: 'SPEC_ID_CHANGED', message } });
    const failure = await gateway.update(SPEC_ID, { name: 'Lid', facts: FACTS, version: 1 }).catch((error: unknown) => error);
    expect(failure).toBeInstanceOf(SpecIdChangedError);
    expect((failure as SpecIdChangedError).code).toBe('SPEC_ID_CHANGED');
    expect((failure as SpecIdChangedError).message).toBe(message);
  });

  it("rejects a change to another product's code with a SpecIdExistsError carrying it", async () => {
    const gateway = gatewayAnswering(409, {
      error: { code: 'SPEC_ID_EXISTS', message: 'This Spec ID already exists.', details: { existing: wireSaved } },
    });
    const failure = await gateway.update(SPEC_ID, { name: 'Lid', facts: FACTS, version: 1 }).catch((error: unknown) => error);
    expect(failure).toBeInstanceOf(SpecIdExistsError);
    expect((failure as SpecIdExistsError).existing.id).toBe(SPEC_ID);
  });

  it("reads a Spec ID's stage counts (#73), and none from an API that sends none", async () => {
    const counts = { specificationsReceived: 2, quoted: 1, sampling: 0, inProduction: 0 };
    const withStages = await gatewayAnswering(200, { data: { ...wireSaved, manufacturerStages: counts } }).getSaved(SPEC_ID);
    const without = await gatewayAnswering(200, { data: wireSaved }).getSaved(SPEC_ID);

    expect(withStages.manufacturerStages).toEqual(counts);
    expect('manufacturerStages' in without).toBe(false);
  });

  it('reads the history, each change with its date as a Date', async () => {
    const sent: Sent[] = [];
    const wire = {
      kind: 'updated',
      changedBy: ben,
      changedAt: '2026-10-17T14:32:00.000Z',
      codeBefore: 'S1.BEFORE',
      codeAfter: ILLUSTRATIVE,
      nameBefore: 'Lid',
      nameAfter: 'Illustrative lid',
      slots: [{ key: 'height', name: 'Height', before: 'Not known', after: '62 mm', corrected: false }],
    };
    const history = await gatewayAnswering(200, { data: [wire] }, sent).history(SPEC_ID);
    expect(sent).toEqual([{ method: 'get', url: `/atlas/saved/${SPEC_ID}/history`, body: undefined }]);
    expect(history).toEqual([{ ...wire, changedAt: new Date('2026-10-17T14:32:00.000Z') }]);
  });
});

describe('HttpAtlasGateway, the library', () => {
  it('asks only for what was given, and returns the page with its total', async () => {
    const sent: Sent[] = [];
    const page = await gatewayAnswering(200, { data: { items: [wireSaved], page: 1, pageSize: 20, total: 4 } }, sent).library({
      q: 'lid',
      productType: '',
      page: undefined,
    });
    expect(sent).toEqual([{ method: 'get', url: '/atlas/saved', body: undefined, params: { q: 'lid' } }]);
    expect(page.items[0]?.savedAt).toEqual(new Date('2026-10-16T08:00:00.000Z'));
    expect(page).toMatchObject({ page: 1, pageSize: 20, total: 4 });
  });

  it('passes the product type and the page', async () => {
    const sent: Sent[] = [];
    await gatewayAnswering(200, { data: { items: [], page: 2, pageSize: 20, total: 21 } }, sent).library({
      q: '',
      productType: 'BLD',
      page: 2,
    });
    expect(sent[0]?.params).toEqual({ productType: 'BLD', page: 2 });
  });

  it('rejects a refused search with an AppError whose fields name the key', async () => {
    const fields = { q: ['Search text must be at most 120 characters.'] };
    const gateway = gatewayAnswering(400, {
      error: { code: 'VALIDATION_FAILED', message: 'The lookup is not valid.', details: { fields } },
    });
    const failure = await gateway.library({ q: 'x'.repeat(121) }).catch((error: unknown) => error);
    expect((failure as AppError).code).toBe('VALIDATION_FAILED');
    expect((failure as AppError).fields).toEqual(fields);
  });
});

describe('HttpAtlasGateway, manufacturers (#57)', () => {
  const SPEC = '00000000-0000-4000-8000-000000000001';
  const ACME = '00000000-0000-4000-8000-00000000ac01';
  /** Invented: never a Source One manufacturer or price (ADR 0027). */
  const wireManufacturer = {
    id: ACME,
    name: 'Acme Packaging',
    country: 'Atlantis',
    stage: 'sampling',
    stageSet: { by: { id: 'admin', fullName: 'Ada Admin' }, at: '2026-10-23T08:00:00.000Z', stage: 'sampling' },
    quotes: [
      {
        itemName: 'Invented PP cup',
        fobPerUnit: '$0.0123',
        fobPerCase: null,
        fobTotal: null,
        moldCost: null,
        moldLeadTime: null,
        sampleLeadTime: '7',
        productionLeadTime: '30 days',
      },
    ],
  };

  it("reads a Spec ID's manufacturers, each stage change's date as a Date", async () => {
    const sent: Sent[] = [];
    const wire = { specId: { id: SPEC, name: 'Invented PP cup', code: ILLUSTRATIVE }, manufacturers: [wireManufacturer] };

    const read = await gatewayAnswering(200, { data: wire }, sent).manufacturers(SPEC);

    expect(sent).toEqual([{ method: 'get', url: `/atlas/saved/${SPEC}/manufacturers`, body: undefined }]);
    expect(read).toEqual({
      ...wire,
      manufacturers: [{ ...wireManufacturer, stageSet: { ...wireManufacturer.stageSet, at: new Date('2026-10-23T08:00:00.000Z') } }],
    });
  });

  it('sends a stage with PUT, and null to clear it', async () => {
    const sent: Sent[] = [];
    const gateway = gatewayAnswering(200, { data: { ...wireManufacturer, stageSet: null, stage: 'quoted' } }, sent);

    await gateway.setManufacturerStage(SPEC, ACME, 'sampling');
    const cleared = await gateway.setManufacturerStage(SPEC, ACME, null);

    expect(sent).toEqual([
      { method: 'put', url: `/atlas/saved/${SPEC}/manufacturers/${ACME}/stage`, body: { stage: 'sampling' } },
      { method: 'put', url: `/atlas/saved/${SPEC}/manufacturers/${ACME}/stage`, body: { stage: null } },
    ]);
    expect(cleared).toMatchObject({ stage: 'quoted', stageSet: null });
  });

  it('turns a 403 into an AppError carrying its message', async () => {
    const refusal = { error: { code: 'NOT_ALLOWED', message: 'You are not allowed to do that.' } };

    const failed = gatewayAnswering(403, refusal).setManufacturerStage(SPEC, ACME, 'sampling');

    await expect(failed).rejects.toBeInstanceOf(AppError);
    await expect(failed).rejects.toMatchObject({ code: 'NOT_ALLOWED', message: 'You are not allowed to do that.' });
  });
});
