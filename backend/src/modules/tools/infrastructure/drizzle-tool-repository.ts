import { sql } from 'drizzle-orm';
import { err, ok, type Result } from '../../../shared/domain/result.js';
import type { Database } from '../../../shared/infrastructure/database/connection.js';
import { isUniqueViolation } from '../../../shared/infrastructure/database/postgres-errors.js';
import { ToolNameTakenError } from '../domain/tool.errors.js';
import type { ToolRepository } from '../domain/tool-repository.js';
import type { Tool } from '../domain/tool.js';
import { toDomain, toRow } from './tool.mapper.js';
import { tools } from './tools.table.js';

export class DrizzleToolRepository implements ToolRepository {
  constructor(private readonly db: Database) {}

  async list(): Promise<Tool[]> {
    const rows = await this.db
      .select()
      .from(tools)
      .orderBy(sql`lower(${tools.category})`, sql`lower(${tools.name})`);
    return rows.map(toDomain);
  }

  async add(tool: Tool): Promise<Result<void, ToolNameTakenError>> {
    try {
      await this.db.insert(tools).values(toRow(tool));
      return ok(undefined);
    } catch (error) {
      if (isUniqueViolation(error)) return err(new ToolNameTakenError(tool.name));
      throw error;
    }
  }
}
