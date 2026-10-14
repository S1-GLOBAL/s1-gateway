import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { SequentialIdGenerator } from '../../../shared/application/testing/fakes.js';
import { connectTestDatabase, resetTables } from '../../../test/database.js';
import { ToolNameTakenError } from '../domain/tool.errors.js';
import { Tool } from '../domain/tool.js';
import { DrizzleToolRepository } from './drizzle-tool-repository.js';

const connection = connectTestDatabase();
const repository = new DrizzleToolRepository(connection.db);
const ids = new SequentialIdGenerator();
const AT = new Date('2026-10-14T08:00:00.000Z');

function tool(name: string, category: string, description = ''): Tool {
  const result = Tool.create({ name, url: 'https://example.com', description, category }, ids.next(), AT);
  if (!result.ok) throw result.error;
  return result.value;
}

beforeEach(() => resetTables(connection.db));
afterAll(() => connection.close());

describe('DrizzleToolRepository', () => {
  it('round-trips every field', async () => {
    const payroll = tool('Payroll', 'Finance', 'Monthly pay');
    await repository.add(payroll);
    const [stored] = await repository.list();
    expect(stored?.id).toBe(payroll.id);
    expect(stored?.name).toBe('Payroll');
    expect(stored?.url).toBe('https://example.com');
    expect(stored?.description).toBe('Monthly pay');
    expect(stored?.category).toBe('Finance');
    expect(stored?.createdAt.toISOString()).toBe(AT.toISOString());
  });

  it('lists by category, then name, ignoring case', async () => {
    await repository.add(tool('Payroll', 'Finance'));
    await repository.add(tool('Leave', 'HR'));
    await repository.add(tool('expenses', 'Finance'));
    const names = (await repository.list()).map((stored) => stored.name);
    expect(names).toEqual(['expenses', 'Payroll', 'Leave']);
  });

  it('refuses a second tool whose name differs only in case', async () => {
    await repository.add(tool('Payroll', 'Finance'));
    const result = await repository.add(tool('PAYROLL', 'Finance'));
    expect(!result.ok && result.error).toBeInstanceOf(ToolNameTakenError);
    expect(await repository.list()).toHaveLength(1);
  });
});
