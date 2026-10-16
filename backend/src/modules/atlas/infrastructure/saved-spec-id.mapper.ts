import { SavedSpecId } from '../domain/saved-spec-id.js';
import { SpecIdChange, type SpecIdChangeKind } from '../domain/spec-id-change.js';
import { FORMAT_VERSION, SLOTS } from '../domain/slots.js';
import { SpecId } from '../domain/spec-id.js';
import type { atlasSpecIdChanges } from './atlas-spec-id-changes.table.js';
import type { atlasSpecIds } from './atlas-spec-ids.table.js';

type SpecIdRow = typeof atlasSpecIds.$inferSelect;
type NewSpecIdRow = typeof atlasSpecIds.$inferInsert;
type ChangeRow = typeof atlasSpecIdChanges.$inferSelect;
type NewChangeRow = typeof atlasSpecIdChanges.$inferInsert;

/** Every slot's raw text, as the row holds it. The format version is not stored: it is always S1. */
function slotValues(row: SpecIdRow) {
  return Object.fromEntries(
    SLOTS.map((slot) => [slot.key, slot.key === 'formatVersion' ? FORMAT_VERSION : row[slot.key]]),
  ) as Parameters<typeof SpecId.restore>[0];
}

export function toDomain(row: SpecIdRow): SavedSpecId {
  return SavedSpecId.restore({
    id: row.id,
    specId: SpecId.restore(slotValues(row)),
    name: row.name,
    dictionaryRelease: row.dictionaryRelease,
    savedBy: row.savedBy,
    savedAt: row.savedAt,
    version: row.version,
    updatedBy: row.updatedBy,
    updatedAt: row.updatedAt,
  });
}

export function toRow(saved: SavedSpecId): NewSpecIdRow {
  const { specId } = saved;
  return {
    id: saved.id,
    code: specId.code,
    productType: specId.slot('productType'),
    material: specId.slot('material'),
    coating: specId.slot('coating'),
    colourClarity: specId.slot('colourClarity'),
    shape: specId.slot('shape'),
    profile: specId.slot('profile'),
    capacity: specId.slot('capacity'),
    topDiameter: specId.slot('topDiameter'),
    bottomDiameter: specId.slot('bottomDiameter'),
    height: specId.slot('height'),
    length: specId.slot('length'),
    width: specId.slot('width'),
    gusset: specId.slot('gusset'),
    unitWeight: specId.slot('unitWeight'),
    basisWeight: specId.slot('basisWeight'),
    thickness: specId.slot('thickness'),
    variant: specId.slot('variant'),
    name: saved.name,
    dictionaryRelease: saved.dictionaryRelease,
    savedBy: saved.savedBy,
    savedAt: saved.savedAt,
    version: saved.version,
    updatedBy: saved.updatedBy,
    updatedAt: saved.updatedAt,
  };
}

export function toChange(row: ChangeRow): SpecIdChange {
  return SpecIdChange.restore({
    id: row.id,
    specId: row.specId,
    kind: row.kind as SpecIdChangeKind,
    changedBy: row.changedBy,
    changedAt: row.changedAt,
    codeBefore: row.codeBefore,
    codeAfter: row.codeAfter,
    nameBefore: row.nameBefore,
    nameAfter: row.nameAfter,
  });
}

export function toChangeRow(change: SpecIdChange): NewChangeRow {
  return {
    id: change.id,
    specId: change.specId,
    kind: change.kind,
    changedBy: change.changedBy,
    changedAt: change.changedAt,
    codeBefore: change.codeBefore,
    codeAfter: change.codeAfter,
    nameBefore: change.nameBefore,
    nameAfter: change.nameAfter,
  };
}
