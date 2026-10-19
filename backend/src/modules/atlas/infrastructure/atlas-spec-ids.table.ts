import { foreignKey, index, integer, pgTable, timestamp, uniqueIndex, uuid, varchar } from 'drizzle-orm/pg-core';
import { accountsTable } from '../../accounts/index.js';
import { atlasDictionaryReleases } from './atlas-dictionary.table.js';

/*
 * Saved Spec IDs. Each slot after the format version is its own column,
 * holding the slot's raw text so `0` and `X` keep their meaning, and is
 * indexed for the similar lookup. The eight slots S2 added are null only on a
 * row an older API saved during a deploy; it is read as its S1 code converts
 * (ADR 0024). A row is updated when its facts or name
 * change, with `version` raised and a row in `atlas_spec_id_changes`; nothing
 * deletes one (ADR 0022).
 */
export const atlasSpecIds = pgTable(
  'atlas_spec_ids',
  {
    id: uuid('id').primaryKey(),
    code: varchar('code', { length: 97 }).notNull(),
    productType: varchar('product_type', { length: 3 }).notNull(),
    material: varchar('material', { length: 3 }).notNull(),
    coating: varchar('coating', { length: 2 }).notNull(),
    colourClarity: varchar('colour_clarity', { length: 2 }).notNull(),
    shape: varchar('shape', { length: 2 }).notNull(),
    profile: varchar('profile', { length: 2 }).notNull(),
    capacity: varchar('capacity', { length: 5 }).notNull(),
    topDiameter: varchar('top_diameter', { length: 4 }).notNull(),
    bottomDiameter: varchar('bottom_diameter', { length: 4 }).notNull(),
    height: varchar('height', { length: 4 }).notNull(),
    length: varchar('length', { length: 4 }).notNull(),
    width: varchar('width', { length: 4 }).notNull(),
    gusset: varchar('gusset', { length: 4 }).notNull(),
    unitWeight: varchar('unit_weight', { length: 4 }).notNull(),
    basisWeight: varchar('basis_weight', { length: 3 }).notNull(),
    thickness: varchar('thickness', { length: 3 }).notNull(),
    wall: varchar('wall', { length: 2 }),
    print: varchar('print', { length: 2 }),
    compartments: varchar('compartments', { length: 2 }),
    plies: varchar('plies', { length: 1 }),
    lidOpening: varchar('lid_opening', { length: 2 }),
    handle: varchar('handle', { length: 2 }),
    wrap: varchar('wrap', { length: 2 }),
    window: varchar('window', { length: 2 }),
    variant: varchar('variant', { length: 2 }).notNull(),
    name: varchar('name', { length: 120 }).notNull(),
    dictionaryRelease: varchar('dictionary_release', { length: 16 }).notNull(),
    savedBy: uuid('saved_by').notNull(),
    savedAt: timestamp('saved_at', { withTimezone: true }).notNull(),
    /** 1 when saved; raised by 1 on every saved change. */
    version: integer('version').notNull().default(1),
    updatedBy: uuid('updated_by'),
    updatedAt: timestamp('updated_at', { withTimezone: true }),
  },
  (table) => [
    // One product, one code. Only the database can enforce that against two
    // simultaneous saves; the repository turns a violation into SPEC_ID_EXISTS.
    uniqueIndex('atlas_spec_ids_code_unique').on(table.code),
    foreignKey({
      name: 'atlas_spec_ids_release_fk',
      columns: [table.dictionaryRelease],
      foreignColumns: [atlasDictionaryReleases.release],
    }),
    foreignKey({ name: 'atlas_spec_ids_saved_by_fk', columns: [table.savedBy], foreignColumns: [accountsTable.id] }),
    foreignKey({ name: 'atlas_spec_ids_updated_by_fk', columns: [table.updatedBy], foreignColumns: [accountsTable.id] }),
    index('atlas_spec_ids_saved_at_idx').on(table.savedAt),
    index('atlas_spec_ids_product_type_idx').on(table.productType),
    index('atlas_spec_ids_material_idx').on(table.material),
    index('atlas_spec_ids_coating_idx').on(table.coating),
    index('atlas_spec_ids_colour_clarity_idx').on(table.colourClarity),
    index('atlas_spec_ids_shape_idx').on(table.shape),
    index('atlas_spec_ids_profile_idx').on(table.profile),
    index('atlas_spec_ids_capacity_idx').on(table.capacity),
    index('atlas_spec_ids_top_diameter_idx').on(table.topDiameter),
    index('atlas_spec_ids_bottom_diameter_idx').on(table.bottomDiameter),
    index('atlas_spec_ids_height_idx').on(table.height),
    index('atlas_spec_ids_length_idx').on(table.length),
    index('atlas_spec_ids_width_idx').on(table.width),
    index('atlas_spec_ids_gusset_idx').on(table.gusset),
    index('atlas_spec_ids_unit_weight_idx').on(table.unitWeight),
    index('atlas_spec_ids_basis_weight_idx').on(table.basisWeight),
    index('atlas_spec_ids_thickness_idx').on(table.thickness),
    index('atlas_spec_ids_wall_idx').on(table.wall),
    index('atlas_spec_ids_print_idx').on(table.print),
    index('atlas_spec_ids_compartments_idx').on(table.compartments),
    index('atlas_spec_ids_plies_idx').on(table.plies),
    index('atlas_spec_ids_lid_opening_idx').on(table.lidOpening),
    index('atlas_spec_ids_handle_idx').on(table.handle),
    index('atlas_spec_ids_wrap_idx').on(table.wrap),
    index('atlas_spec_ids_window_idx').on(table.window),
  ],
);
