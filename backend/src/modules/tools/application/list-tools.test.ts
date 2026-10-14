import { describe, expect, it } from 'vitest';
import { FixedClock, SequentialIdGenerator } from '../../../shared/application/testing/fakes.js';
import { CreateTool } from './create-tool.js';
import { ListTools } from './list-tools.js';
import { InMemoryToolRepository } from './testing/in-memory-tool-repository.js';

describe('ListTools', () => {
  it('is empty before anything is added', async () => {
    expect(await new ListTools(new InMemoryToolRepository()).execute()).toEqual([]);
  });

  it('lists tools by category, then name', async () => {
    const repository = new InMemoryToolRepository();
    const createTool = new CreateTool(repository, new FixedClock(new Date()), new SequentialIdGenerator());
    for (const [name, category] of [['Payroll', 'Finance'], ['Leave', 'HR'], ['expenses', 'Finance']]) {
      await createTool.execute({ name: name!, url: 'https://example.com', category: category! });
    }

    const tools = await new ListTools(repository).execute();
    expect(tools.map((tool) => `${tool.category}/${tool.name}`)).toEqual([
      'Finance/expenses',
      'Finance/Payroll',
      'HR/Leave',
    ]);
  });
});
