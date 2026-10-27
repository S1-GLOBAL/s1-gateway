import { S1_ADDED_SLOTS, shortForm, shortPart } from '../domain/old-codes.js';
import { SavedSpecId } from '../domain/saved-spec-id.js';
import { SpecIdChange, type SpecIdChangeKind } from '../domain/spec-id-change.js';
import { NOT_KNOWN, SLOTS, type SlotKey } from '../domain/slots.js';
import { SpecId } from '../domain/spec-id.js';
import type { atlasSpecIdChanges } from './atlas-spec-id-changes.table.js';
import type { atlasSpecIds } from './atlas-spec-ids.table.js';

type SpecIdRow = typeof atlasSpecIds.$inferSelect;
type NewSpecIdRow = typeof atlasSpecIds.$inferInsert;
type ChangeRow = typeof atlasSpecIdChanges.$inferSelect;
type NewChangeRow = typeof atlasSpecIdChanges.$inferInsert;

/** The eight slots S2 added, in code order. */
const ADDED_SLOTS = ['wall', 'print', 'compartments', 'plies', 'lidOpening', 'handle', 'wrap', 'window'] as const;

/**
 * Every slot's raw text, as the row holds it, in the short form (ADR 0025).
 * A row an older API saved during a deploy holds its markers written wide,
 * or, saved before S2, no added slots: they are read as its old code converts.
 */
function slotValues(row: SpecIdRow) {
  const added = (S1_ADDED_SLOTS[row.productType] ?? '').split('.');
  const valueOf = (key: SlotKey): string => {
    const index = (ADDED_SLOTS as readonly string[]).indexOf(key);
    if (index === -1) return shortPart(row[key as Exclude<SlotKey, (typeof ADDED_SLOTS)[number]>]);
    return shortPart(row[ADDED_SLOTS[index] as (typeof ADDED_SLOTS)[number]] ?? added[index] ?? NOT_KNOWN);
  };
  return Object.fromEntries(SLOTS.map((slot) => [slot.key, valueOf(slot.key)])) as Parameters<
    typeof SpecId.restore
  >[0];
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
    wall: specId.slot('wall'),
    print: specId.slot('print'),
    compartments: specId.slot('compartments'),
    plies: specId.slot('plies'),
    lidOpening: specId.slot('lidOpening'),
    handle: specId.slot('handle'),
    wrap: specId.slot('wrap'),
    window: specId.slot('window'),
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
    // A code an older API wrote during a deploy is read in the short form.
    codeBefore: row.codeBefore === null ? null : shortForm(row.codeBefore),
    codeAfter: shortForm(row.codeAfter),
    nameBefore: row.nameBefore,
    nameAfter: row.nameAfter,
    dictionaryChangeNumber: row.dictionaryChangeNumber,
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
    dictionaryChangeNumber: change.dictionaryChangeNumber,
  };
}
