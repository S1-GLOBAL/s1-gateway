import { readFileSync } from 'node:fs';
import { asc, sql } from 'drizzle-orm';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { connectTestDatabase, resetTables } from '../../../test/database.js';
import { accounts } from './accounts.table.js';

const connection = connectTestDatabase();
const BACKFILL = readFileSync(new URL('../../../../drizzle/0008_backfill_person_names.sql', import.meta.url), 'utf8');

/** An account row as it stood before names were split: only full_name. */
function row(n: number, fullName: string) {
  return {
    id: `00000000-0000-4000-8000-00000000000${n}`,
    email: `person${n}@sourceone.global`,
    fullName,
    passwordHash: 'hash',
    status: 'approved',
    createdAt: new Date('2026-10-16T08:00:00.000Z'),
  };
}

async function names() {
  const rows = await connection.db
    .select({ firstName: accounts.firstName, lastName: accounts.lastName })
    .from(accounts)
    .orderBy(asc(accounts.id));
  return rows.map((stored) => [stored.firstName, stored.lastName]);
}

beforeEach(() => resetTables(connection.db));
afterAll(() => connection.close());

describe('the backfill migration, 0008', () => {
  it('splits every full name at its first space, and a one-word name has no last name', async () => {
    await connection.db
      .insert(accounts)
      .values([row(1, 'Ada Lovelace'), row(2, 'Ada King Lovelace'), row(3, 'Admin')]);

    await connection.db.execute(sql.raw(BACKFILL));

    expect(await names()).toEqual([
      ['Ada', 'Lovelace'],
      ['Ada', 'King Lovelace'],
      ['Admin', ''],
    ]);
  });

  it('cuts a part over 40 characters to 40', async () => {
    await connection.db
      .insert(accounts)
      .values([row(1, `${'A'.repeat(45)} ${'B'.repeat(34)}`), row(2, `Ada ${'B'.repeat(39)} ${'C'.repeat(30)}`)]);

    await connection.db.execute(sql.raw(BACKFILL));

    expect(await names()).toEqual([
      ['A'.repeat(40), 'B'.repeat(34)],
      ['Ada', 'B'.repeat(39)],
    ]);
  });
});
