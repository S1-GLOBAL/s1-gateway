import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { FixedClock, RecordingLogger, SequentialIdGenerator } from '../../../shared/application/testing/fakes.js';
import { createApp } from '../../../shared/presentation/http/create-app.js';
import { DecodeSpecId } from '../application/decode-spec-id.js';
import { EncodeSpecId } from '../application/encode-spec-id.js';
import { FindSimilarSpecIds } from '../application/find-similar-spec-ids.js';
import { FindSpecIdByCode } from '../application/find-spec-id-by-code.js';
import { GetDictionary } from '../application/get-dictionary.js';
import { GetSavedSpecId } from '../application/get-saved-spec-id.js';
import { GetSpecIdHistory } from '../application/get-spec-id-history.js';
import { ListSavedSpecIds } from '../application/list-saved-spec-ids.js';
import { SaveSpecId } from '../application/save-spec-id.js';
import { UpdateSpecId } from '../application/update-spec-id.js';
import { InMemoryDictionaryRepository } from '../application/testing/in-memory-dictionary-repository.js';
import { InMemorySpecIdRepository } from '../application/testing/in-memory-spec-id-repository.js';
import { AtlasController } from './atlas.controller.js';
import { createAtlasRouter } from './atlas.routes.js';

const ILLUSTRATIVE = 'S1.BLD.APS.00.CL.RD.DM.XXXXX.0090.XXXX.0000.XXXX.XXXX.XXXX.0033.XXX.000.XX';
const FACTS = {
  productType: 'BLD',
  material: 'APS',
  colourClarity: 'CL',
  shape: 'RD',
  profile: 'DM',
  topDiameter: { value: '90', unit: 'mm' },
  unitWeight: { value: '3.3', unit: 'g' },
};

const STAFF = { id: '00000000-0000-4000-8000-0000000000aa', fullName: 'Ada Invented' };

function setup() {
  const dictionaries = new InMemoryDictionaryRepository();
  const specIds = new InMemorySpecIdRepository();
  specIds.nameSaver(STAFF.id, STAFF.fullName);
  const controller = new AtlasController(
    new GetDictionary(dictionaries),
    new DecodeSpecId(dictionaries),
    new EncodeSpecId(dictionaries),
    new SaveSpecId(
      dictionaries,
      specIds,
      new FixedClock(new Date('2026-10-16T08:00:00.000Z')),
      new SequentialIdGenerator(),
    ),
    new FindSpecIdByCode(dictionaries, specIds),
    new FindSimilarSpecIds(dictionaries, specIds),
    () => STAFF,
    {
      getSaved: new GetSavedSpecId(dictionaries, specIds),
      update: new UpdateSpecId(
        dictionaries,
        specIds,
        new FixedClock(new Date('2026-10-17T08:00:00.000Z')),
        new SequentialIdGenerator(),
      ),
      history: new GetSpecIdHistory(dictionaries, specIds),
      library: new ListSavedSpecIds(dictionaries, specIds),
    },
  );
  // Atlas route shape only — production mounts Atlas behind the session gate.
  return createApp({
    modules: [{ path: '/atlas', router: createAtlasRouter(controller), access: 'public' }],
    logger: new RecordingLogger(),
    corsOrigin: 'http://localhost:5173',
  });
}

const app = setup();
const decode = (code: string) => request(app).post('/api/v1/atlas/spec-ids/decode').send({ code });
const encode = (facts: object) => request(app).post('/api/v1/atlas/spec-ids/encode').send({ facts });

describe('GET /api/v1/atlas/dictionary', () => {
  it('answers the current release with its values and rules', async () => {
    const response = await request(app).get('/api/v1/atlas/dictionary');
    expect(response.status).toBe(200);
    expect(response.body.data.release).toBe('S1 0.1.0');
    expect(response.body.data.approvedOn).toBe('2026-10-16');
    expect(response.body.data.slots).toHaveLength(7);
    expect(response.body.data.rules).toHaveLength(56);
  });
});

describe('POST /api/v1/atlas/spec-ids/decode', () => {
  it('answers 200 with the illustrative code read slot by slot', async () => {
    const response = await decode(ILLUSTRATIVE);
    expect(response.status).toBe(200);
    expect(response.body.data.code).toBe(ILLUSTRATIVE);
    expect(response.body.data.dictionaryRelease).toBe('S1 0.1.0');
    expect(response.body.data.slots).toHaveLength(18);
    expect(response.body.data.slots[1]).toEqual({
      number: 2,
      key: 'productType',
      name: 'Product type',
      raw: 'BLD',
      state: 'value',
      meaning: 'Bowl lid',
    });
  });

  it('answers 400 VALIDATION_FAILED for a body without a code', async () => {
    const response = await request(app).post('/api/v1/atlas/spec-ids/decode').send({});
    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('VALIDATION_FAILED');
    expect(response.body.error.details.fields.code).toEqual([expect.any(String)]);
  });

  it.each<[string, string, Record<string, string[]>]>([
    [
      'S1.BLD',
      'S1.BLD',
      {
        code: ['A Spec ID is 74 characters. This one has 6.', 'A Spec ID has 18 parts separated by dots. This one has 2.'],
      },
    ],
    [
      'the last dot replaced by a dash',
      ILLUSTRATIVE.replace(/\.(?=XX$)/, '-'),
      { code: ['A Spec ID has 18 parts separated by dots. This one has 17.'] },
    ],
    [
      'S2',
      ILLUSTRATIVE.replace('S1.', 'S2.'),
      { formatVersion: ['Only S1 codes can be read here. This code starts with S2.'] },
    ],
    ['QQQ', ILLUSTRATIVE.replace('.APS.', '.QQQ.'), { material: ['Material: QQQ is not in the dictionary.'] }],
    [
      '0X90',
      ILLUSTRATIVE.replace('.0090.', '.0X90.'),
      { topDiameter: ['Top diameter: 0X90 mixes a marker with other characters.'] },
    ],
    [
      'Z0006',
      ILLUSTRATIVE.replace('.XXXXX.', '.Z0006.'),
      { capacity: ['Nominal capacity must be XXXXX for a bowl lid.'] },
    ],
    [
      'height XXXX',
      ILLUSTRATIVE.replace('.0000.XXXX.XXXX.XXXX.', '.XXXX.XXXX.XXXX.XXXX.'),
      { height: ['Height can\'t be "doesn\'t apply" for a bowl lid.'] },
    ],
    ['an empty box', '   ', { code: ['Paste a Spec ID to read it.'] }],
    [
      'product type 000',
      ILLUSTRATIVE.replace('.BLD.', '.000.'),
      { productType: ['Product type can\'t be "not known": it decides which slots apply.'] },
    ],
    [
      'shape 00',
      ILLUSTRATIVE.replace('.RD.', '.00.'),
      {
        topDiameter: ['Top diameter must be 0000 while the shape is not known.'],
        length: ['Length must be 0000 while the shape is not known.'],
        width: ['Width must be 0000 while the shape is not known.'],
      },
    ],
    [
      '090',
      ILLUSTRATIVE.replace('.0090.', '.090.'),
      {
        code: ['A Spec ID is 74 characters. This one has 73.'],
        topDiameter: ['Top diameter: 090 must be 4 characters.'],
      },
    ],
    ['00A3', ILLUSTRATIVE.replace('.0033.', '.00A3.'), { unitWeight: ['Unit weight: 00A3 is not a number.'] }],
  ])('answers 400 INVALID_SPEC_ID for %s', async (_case, code, fields) => {
    const response = await decode(code);
    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('INVALID_SPEC_ID');
    expect(response.body.error.message).toBe('The Spec ID is not valid.');
    expect(response.body.error.details.fields).toEqual(fields);
  });
});

describe('POST /api/v1/atlas/spec-ids/encode', () => {
  it('answers 200 with the code built from the facts', async () => {
    const response = await encode(FACTS);
    expect(response.status).toBe(200);
    expect(response.body.data.code).toBe(ILLUSTRATIVE);
    expect(response.body.data.slots).toHaveLength(18);
  });

  it('answers 400 VALIDATION_FAILED for a body without facts', async () => {
    const response = await request(app).post('/api/v1/atlas/spec-ids/encode').send({});
    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('VALIDATION_FAILED');
  });

  it.each<[string, object, Record<string, string[]>]>([
    [
      'height 12000 mm',
      { ...FACTS, height: { value: '12000', unit: 'mm' } },
      { height: ['Height: 12000 mm is outside 1–9999 mm.'] },
    ],
    [
      'unit weight 0.04 g',
      { ...FACTS, unitWeight: { value: '0.04', unit: 'g' } },
      { unitWeight: ['Unit weight: 0.04 g is outside 0.1–999.9 g.'] },
    ],
    [
      'unit weight in kg',
      { ...FACTS, unitWeight: { value: '3.3', unit: 'kg' } },
      { unitWeight: ['Unit weight: kg is not a unit for this slot. Use g.'] },
    ],
    [
      'seven decimal places',
      { ...FACTS, height: { value: '1.1234567', unit: 'in' } },
      { height: ['Height: 1.1234567 in has more than 6 decimal places.'] },
    ],
    [
      'a letter O for a zero',
      { ...FACTS, height: { value: '9O', unit: 'mm' } },
      { height: ['Height: 9O is not a number.'] },
    ],
    [
      'a capacity of 6.5',
      { productType: 'BWL', capacity: { unit: 'Z', value: '6.5' } },
      { capacity: ['Nominal capacity: 6.5 must be a whole number.'] },
    ],
    [
      'a profile on a bowl',
      { productType: 'BWL', shape: 'RD', profile: 'DM' },
      { profile: ['Profile must be XX for a bowl.'] },
    ],
    [
      'a thickness of 0',
      { ...FACTS, thickness: { value: '0', unit: 'um' } },
      { thickness: ['Thickness: 0 µm is outside 1–999 µm.'] },
    ],
  ])('answers 400 INVALID_SPEC_ID for %s', async (_case, facts, fields) => {
    const response = await encode(facts);
    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('INVALID_SPEC_ID');
    expect(response.body.error.details.fields).toEqual(fields);
  });
});

describe('POST /api/v1/atlas/spec-ids', () => {
  const save = (agent: ReturnType<typeof setup>, body: object) =>
    request(agent).post('/api/v1/atlas/spec-ids').send(body);

  it('answers 201 with the saved Spec ID, its name, who saved it and when', async () => {
    const response = await save(setup(), { name: '  Illustrative lid ', facts: FACTS });

    expect(response.status).toBe(201);
    expect(response.body.data.code).toBe(ILLUSTRATIVE);
    expect(response.body.data.name).toBe('Illustrative lid');
    expect(response.body.data.savedBy).toEqual(STAFF);
    expect(response.body.data.savedAt).toBe('2026-10-16T08:00:00.000Z');
    expect(response.body.data.slots).toHaveLength(18);
  });

  it('answers 409 SPEC_ID_EXISTS with the Spec ID already saved, for a second save', async () => {
    const own = setup();
    await save(own, { name: 'First', facts: FACTS });

    const response = await save(own, { name: 'Second', facts: FACTS });

    expect(response.status).toBe(409);
    expect(response.body.error.code).toBe('SPEC_ID_EXISTS');
    expect(response.body.error.message).toBe('This Spec ID already exists. Nothing new was saved.');
    expect(response.body.error.details.existing.name).toBe('First');
    expect(response.body.error.details.existing.savedBy.fullName).toBe('Ada Invented');
  });

  it('answers 400 INVALID_SPEC_ID with the name and the slot problems together', async () => {
    const response = await save(setup(), { name: ' ', facts: { ...FACTS, height: { value: '0', unit: 'mm' } } });

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('INVALID_SPEC_ID');
    expect(response.body.error.details.fields).toEqual({
      height: ['Height: 0 mm is outside 1–9999 mm.'],
      name: ['Name is required.'],
    });
  });

  it('answers 400 VALIDATION_FAILED for a body without a name', async () => {
    const response = await save(setup(), { facts: FACTS });
    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('VALIDATION_FAILED');
  });
});

describe('GET /api/v1/atlas/spec-ids/:code', () => {
  it('answers 200 with a saved Spec ID, found by its code with dots', async () => {
    const own = setup();
    await request(own).post('/api/v1/atlas/spec-ids').send({ name: 'Illustrative lid', facts: FACTS });

    const response = await request(own).get(`/api/v1/atlas/spec-ids/${encodeURIComponent(ILLUSTRATIVE)}`);

    expect(response.status).toBe(200);
    expect(response.body.data.name).toBe('Illustrative lid');
  });

  it('answers 404 SPEC_ID_NOT_FOUND for a code nobody saved', async () => {
    const response = await request(setup()).get(`/api/v1/atlas/spec-ids/${encodeURIComponent(ILLUSTRATIVE)}`);

    expect(response.status).toBe(404);
    expect(response.body.error.code).toBe('SPEC_ID_NOT_FOUND');
    expect(response.body.error.message).toBe('No saved Spec ID has this code. Check it, or build and save it.');
  });
});

describe('GET /api/v1/atlas/spec-ids', () => {
  it('answers fits and mightFit for the slots chosen', async () => {
    const own = setup();
    const lid = (name: string, rim?: string) =>
      request(own)
        .post('/api/v1/atlas/spec-ids')
        .send({ name, facts: { ...FACTS, topDiameter: rim ? { value: rim, unit: 'mm' } : null } });
    await lid('Unstated rim');
    await lid('Rim 90', '90');
    await lid('Rim 91', '91');

    const response = await request(own).get('/api/v1/atlas/spec-ids?topDiameter=0090');

    expect(response.status).toBe(200);
    expect(response.body.data.fits.map((saved: { name: string }) => saved.name)).toEqual(['Rim 90']);
    expect(response.body.data.mightFit.map((saved: { name: string }) => saved.name)).toEqual(['Unstated rim']);
  });

  it('answers every saved Spec ID under fits when nothing is chosen', async () => {
    const own = setup();
    await request(own).post('/api/v1/atlas/spec-ids').send({ name: 'Illustrative lid', facts: FACTS });

    const response = await request(own).get('/api/v1/atlas/spec-ids');

    expect(response.status).toBe(200);
    expect(response.body.data.fits).toHaveLength(1);
    expect(response.body.data.mightFit).toEqual([]);
  });

  it('answers 400 VALIDATION_FAILED for an unknown key, a repeated key and a bad value', async () => {
    const response = await request(setup()).get('/api/v1/atlas/spec-ids?colour=CL&height=0090&height=0091&shape=QQ');

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('VALIDATION_FAILED');
    expect(response.body.error.message).toBe('The lookup is not valid.');
    expect(response.body.error.details.fields).toEqual({
      colour: ['Not a slot of an S1 Spec ID.'],
      height: ['Choose one value.'],
      shape: ['Shape: QQ is not in the dictionary.'],
    });
  });
});

describe('nothing replaces or removes a Spec ID by its code', () => {
  it.each(['/api/v1/atlas/spec-ids', `/api/v1/atlas/spec-ids/${encodeURIComponent(ILLUSTRATIVE)}`])(
    'answers 404 NOT_FOUND to PUT, PATCH and DELETE on %s',
    async (path) => {
      for (const method of ['put', 'patch', 'delete'] as const) {
        const response = await request(app)[method](path).send({});
        expect({ method, status: response.status, code: response.body.error?.code }).toEqual({
          method,
          status: 404,
          code: 'NOT_FOUND',
        });
      }
    },
  );
});

describe('saved Spec IDs by id', () => {
  const ID = '00000000-0000-4000-8000-000000000001';
  const saveOne = async (own: ReturnType<typeof setup>) => {
    const saved = await request(own).post('/api/v1/atlas/spec-ids').send({ name: 'Illustrative lid', facts: FACTS });
    return saved.body.data as { id: string; version: number };
  };
  const patch = (own: ReturnType<typeof setup>, id: string, body: object) =>
    request(own).patch(`/api/v1/atlas/saved/${id}`).send(body);

  it('answers GET /saved/:id with the Spec ID, its version and who changed it', async () => {
    const own = setup();
    const { id } = await saveOne(own);

    const response = await request(own).get(`/api/v1/atlas/saved/${id}`);

    expect(response.status).toBe(200);
    expect(response.body.data).toMatchObject({ id, code: ILLUSTRATIVE, version: 1, updatedBy: null, updatedAt: null });
  });

  it('answers PATCH /saved/:id with the changed Spec ID', async () => {
    const own = setup();
    const { id } = await saveOne(own);

    const response = await patch(own, id, {
      name: 'Illustrative lid',
      facts: { ...FACTS, height: { value: '12', unit: 'mm' } },
      version: 1,
    });

    expect(response.status).toBe(200);
    expect(response.body.data.code).toBe(ILLUSTRATIVE.replace('.0000.', '.0012.'));
    expect(response.body.data.version).toBe(2);
    expect(response.body.data.updatedBy).toEqual(STAFF);
    expect(response.body.data.updatedAt).toBe('2026-10-17T08:00:00.000Z');
  });

  it('answers 409 SPEC_ID_CHANGED to a change from an older version', async () => {
    const own = setup();
    const { id } = await saveOne(own);
    await patch(own, id, { name: 'First change', facts: FACTS, version: 1 });

    const response = await patch(own, id, { name: 'Second change', facts: FACTS, version: 1 });

    expect(response.status).toBe(409);
    expect(response.body.error.code).toBe('SPEC_ID_CHANGED');
    expect(response.body.error.message).toBe(
      'Someone changed this Spec ID while you were editing. Reload to see their changes, then make yours again.',
    );
  });

  it('answers 409 SPEC_ID_EXISTS, naming the other Spec ID, to facts that give it its code', async () => {
    const own = setup();
    const { id } = await saveOne(own);
    const withHeight = { ...FACTS, height: { value: '12', unit: 'mm' } };
    await request(own).post('/api/v1/atlas/spec-ids').send({ name: 'Lid, 12 mm', facts: withHeight });

    const response = await patch(own, id, { name: 'Illustrative lid', facts: withHeight, version: 1 });

    expect(response.status).toBe(409);
    expect(response.body.error.code).toBe('SPEC_ID_EXISTS');
    expect(response.body.error.details.existing.name).toBe('Lid, 12 mm');
  });

  it('answers 400 VALIDATION_FAILED to a change without a version', async () => {
    const own = setup();
    const { id } = await saveOne(own);
    const response = await patch(own, id, { name: 'Illustrative lid', facts: FACTS });
    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('VALIDATION_FAILED');
  });

  it('answers GET /saved/:id/history newest first', async () => {
    const own = setup();
    const { id } = await saveOne(own);
    await patch(own, id, { name: 'Clear dome lid', facts: FACTS, version: 1 });

    const response = await request(own).get(`/api/v1/atlas/saved/${id}/history`);

    expect(response.status).toBe(200);
    expect(response.body.data.map((entry: { kind: string }) => entry.kind)).toEqual(['updated', 'created']);
    expect(response.body.data[0].nameBefore).toBe('Illustrative lid');
    expect(response.body.data[0].nameAfter).toBe('Clear dome lid');
  });

  it.each(['get', 'patch'] as const)('answers 404 SPEC_ID_NOT_FOUND to %s on an id nobody saved', async (method) => {
    const response = await request(setup())
      [method](`/api/v1/atlas/saved/${ID}`)
      .send({ name: 'Illustrative lid', facts: FACTS, version: 1 });
    expect(response.status).toBe(404);
    expect(response.body.error.code).toBe('SPEC_ID_NOT_FOUND');
    expect(response.body.error.message).toBe("This Spec ID doesn't exist. It may have been typed wrong.");
  });

  it.each(['/api/v1/atlas/saved/not-a-uuid', '/api/v1/atlas/saved/not-a-uuid/history'])(
    'answers 404 SPEC_ID_NOT_FOUND to an id that is not an id: GET %s',
    async (path) => {
      const response = await request(app).get(path);
      expect(response.status).toBe(404);
      expect(response.body.error.code).toBe('SPEC_ID_NOT_FOUND');
    },
  );

  it('answers 404 SPEC_ID_NOT_FOUND to PATCH on an id that is not an id', async () => {
    const response = await patch(app, 'not-a-uuid', { name: 'Illustrative lid', facts: FACTS, version: 1 });
    expect(response.status).toBe(404);
    expect(response.body.error.code).toBe('SPEC_ID_NOT_FOUND');
  });

  it('answers 404 NOT_FOUND to PUT and DELETE: a saved Spec ID is never replaced or removed', async () => {
    for (const method of ['put', 'delete'] as const) {
      const response = await request(app)[method](`/api/v1/atlas/saved/${ID}`).send({});
      expect({ method, status: response.status, code: response.body.error?.code }).toEqual({
        method,
        status: 404,
        code: 'NOT_FOUND',
      });
    }
  });
});

describe('GET /api/v1/atlas/saved', () => {
  it('answers a page of the library with no next cursor', async () => {
    const own = setup();
    await request(own).post('/api/v1/atlas/spec-ids').send({ name: 'Illustrative lid', facts: FACTS });

    const response = await request(own).get('/api/v1/atlas/saved');

    expect(response.status).toBe(200);
    expect(response.body.data.items.map((item: { name: string }) => item.name)).toEqual(['Illustrative lid']);
    expect(response.body.data.nextCursor).toBeNull();
  });

  it('answers 400 VALIDATION_FAILED to a cursor it did not write', async () => {
    const response = await request(app).get('/api/v1/atlas/saved?cursor=not-a-cursor');
    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('VALIDATION_FAILED');
    expect(response.body.error.details.fields.cursor).toEqual([
      'Not a page of this list. Start again from the first page.',
    ]);
  });
});

describe('GET /api/v1/atlas/spec-ids/:code, as a lookup', () => {
  it('finds a code typed in lower case, and names no former holders', async () => {
    const own = setup();
    await request(own).post('/api/v1/atlas/spec-ids').send({ name: 'Illustrative lid', facts: FACTS });

    const response = await request(own).get(
      `/api/v1/atlas/spec-ids/${encodeURIComponent(ILLUSTRATIVE.toLowerCase())}`,
    );

    expect(response.status).toBe(200);
    expect(response.body.data.name).toBe('Illustrative lid');
    expect(response.body.data.replacedCode).toBeNull();
    expect(response.body.data.formerHolders).toEqual([]);
  });
});
