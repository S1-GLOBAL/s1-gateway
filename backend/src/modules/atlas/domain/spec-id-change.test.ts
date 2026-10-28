import { describe, expect, it } from 'vitest';
import { SavedSpecId } from './saved-spec-id.js';
import { SpecIdChange } from './spec-id-change.js';
import { SpecId } from './spec-id.js';
import { s2Dictionary } from './testing/s2-dictionary.js';

const ILLUSTRATIVE = 'BLD.APS.Y.CL.RD.DM.X.0090.X.Y.X.X.X.0033.X.Y.X.Y.X.X.X.X.X.X.X';
const WITH_HEIGHT = 'BLD.APS.Y.CL.RD.DM.X.0090.X.0012.X.X.X.0033.X.Y.X.Y.X.X.X.X.X.X.X';
/** The two codes as History records them (ADR 0032). */
const ILLUSTRATIVE_CODE = 'A1B4D1E1F1-H90N33';
const WITH_HEIGHT_CODE = 'A1B4D1E1F1-H90J12N33';
const SAVER = '00000000-0000-4000-8000-0000000000aa';
const EDITOR = '00000000-0000-4000-8000-0000000000bb';

function parsed(code: string): SpecId {
  const result = SpecId.parse(code, s2Dictionary());
  if (!result.ok) throw result.error;
  return result.value;
}

const saved = SavedSpecId.restore({
  id: '00000000-0000-4000-8000-000000000001',
  specId: parsed(ILLUSTRATIVE),
  name: 'Illustrative lid',
  dictionaryRelease: 'S2 0.1.0',
  savedBy: SAVER,
  savedAt: new Date('2026-10-16T08:00:00.000Z'),
});

function revised(code: string, name: string): SavedSpecId {
  const result = saved.revise({
    specId: parsed(code),
    name,
    dictionaryRelease: 'S2 0.1.0',
    by: EDITOR,
    at: new Date('2026-10-17T08:00:00.000Z'),
  });
  if (!result.ok) throw result.error;
  return result.value;
}

describe('SpecIdChange.created', () => {
  it('records who saved it, when, the code and the name, with nothing before', () => {
    const change = SpecIdChange.created(saved, '00000000-0000-4000-8000-0000000000c1');
    expect(change.kind).toBe('created');
    expect(change.specId).toBe(saved.id);
    expect(change.changedBy).toBe(SAVER);
    expect(change.changedAt.toISOString()).toBe('2026-10-16T08:00:00.000Z');
    expect(change.codeBefore).toBeNull();
    expect(change.codeAfter).toBe(ILLUSTRATIVE_CODE);
    expect(change.nameBefore).toBeNull();
    expect(change.nameAfter).toBe('Illustrative lid');
    expect(change.isEmpty).toBe(false);
  });
});

describe('SpecIdChange.updated', () => {
  it('records who changed it, when, and the code and name before and after', () => {
    const change = SpecIdChange.updated(saved, revised(WITH_HEIGHT, 'Lid, 12 mm'), '00000000-0000-4000-8000-0000000000c2');
    expect(change.kind).toBe('updated');
    expect(change.changedBy).toBe(EDITOR);
    expect(change.changedAt.toISOString()).toBe('2026-10-17T08:00:00.000Z');
    expect(change.codeBefore).toBe(ILLUSTRATIVE_CODE);
    expect(change.codeAfter).toBe(WITH_HEIGHT_CODE);
    expect(change.nameBefore).toBe('Illustrative lid');
    expect(change.nameAfter).toBe('Lid, 12 mm');
  });

  it('is empty when neither the code nor the name changed', () => {
    const change = SpecIdChange.updated(saved, revised(ILLUSTRATIVE, 'Illustrative lid'), '00000000-0000-4000-8000-0000000000c3');
    expect(change.isEmpty).toBe(true);
  });

  it('is not empty when only the name changed', () => {
    const change = SpecIdChange.updated(saved, revised(ILLUSTRATIVE, 'Clear dome lid'), '00000000-0000-4000-8000-0000000000c4');
    expect(change.isEmpty).toBe(false);
  });

  it('refuses a Spec ID that does not say who changed it', () => {
    expect(() => SpecIdChange.updated(saved, saved, '00000000-0000-4000-8000-0000000000c5')).toThrow(
      'An updated Spec ID names who changed it and when',
    );
  });
});
