import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { RecordingLogger } from '../../../shared/application/testing/fakes.js';
import { createApp } from '../../../shared/presentation/http/create-app.js';
import { DecodeSpecId } from '../application/decode-spec-id.js';
import { EncodeSpecId } from '../application/encode-spec-id.js';
import { GetDictionary } from '../application/get-dictionary.js';
import { InMemoryDictionaryRepository } from '../application/testing/in-memory-dictionary-repository.js';
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

function setup() {
  const dictionaries = new InMemoryDictionaryRepository();
  const controller = new AtlasController(
    new GetDictionary(dictionaries),
    new DecodeSpecId(dictionaries),
    new EncodeSpecId(dictionaries),
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
