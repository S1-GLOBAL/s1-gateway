import { describe, expect, it } from 'vitest';
import { FixedClock, SequentialIdGenerator } from '../../../shared/application/testing/fakes.js';
import { InvalidToolError, ToolNameTakenError } from '../domain/tool.errors.js';
import { CreateTool } from './create-tool.js';
import { InMemoryToolRepository } from './testing/in-memory-tool-repository.js';

const payroll = { name: 'Payroll', url: 'https://payroll.example.com', category: 'Finance' };

function setup() {
  const repository = new InMemoryToolRepository();
  const createTool = new CreateTool(
    repository,
    new FixedClock(new Date('2026-10-14T08:00:00.000Z')),
    new SequentialIdGenerator(),
  );
  return { repository, createTool };
}

describe('CreateTool', () => {
  it('returns the new tool with its id and creation time', async () => {
    const { createTool } = setup();
    expect(await createTool.execute(payroll)).toEqual({
      ok: true,
      value: {
        id: '00000000-0000-4000-8000-000000000001',
        name: 'Payroll',
        url: 'https://payroll.example.com',
        description: '',
        category: 'Finance',
        createdAt: '2026-10-14T08:00:00.000Z',
      },
    });
  });

  it('stores the tool', async () => {
    const { repository, createTool } = setup();
    await createTool.execute(payroll);
    expect((await repository.list()).map((tool) => tool.name)).toEqual(['Payroll']);
  });

  it('rejects an invalid tool and stores nothing', async () => {
    const { repository, createTool } = setup();
    const result = await createTool.execute({ ...payroll, name: ' ' });
    expect(!result.ok && result.error).toBeInstanceOf(InvalidToolError);
    expect(await repository.list()).toEqual([]);
  });

  it('rejects a taken name, ignoring case and surrounding spaces', async () => {
    const { repository, createTool } = setup();
    await createTool.execute(payroll);
    const result = await createTool.execute({ ...payroll, name: '  PAYROLL ' });
    expect(!result.ok && result.error).toBeInstanceOf(ToolNameTakenError);
    expect(await repository.list()).toHaveLength(1);
  });
});
