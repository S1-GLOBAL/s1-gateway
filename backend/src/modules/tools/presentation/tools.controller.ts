import type { Request, Response } from 'express';
import type { Tool as ToolContract } from '../../../contracts/tools.js';
import type { UseCase } from '../../../shared/application/use-case.js';
import type { Result } from '../../../shared/domain/result.js';
import { HttpError } from '../../../shared/presentation/http/http-error.js';
import { parseBody } from '../../../shared/presentation/http/parse-body.js';
import { sendData } from '../../../shared/presentation/http/respond.js';
import type { CreateToolError } from '../application/create-tool.js';
import type { CreateToolInput, ToolDto } from '../application/tool.dto.js';
import { createToolRequestSchema } from './tools.schemas.js';

const STATUS_BY_CODE: Record<CreateToolError['code'], number> = {
  VALIDATION_FAILED: 400,
  TOOL_NAME_TAKEN: 409,
};

/** Translates HTTP into use-case calls and results back into HTTP. No business rules here. */
export class ToolsController {
  constructor(
    private readonly listTools: UseCase<void, ToolDto[]>,
    private readonly createTool: UseCase<CreateToolInput, Result<ToolDto, CreateToolError>>,
  ) {}

  list = async (_req: Request, res: Response): Promise<void> => {
    const tools: ToolContract[] = await this.listTools.execute();
    sendData(res, 200, tools);
  };

  create = async (req: Request, res: Response): Promise<void> => {
    const input = parseBody(createToolRequestSchema, req.body);
    const result = await this.createTool.execute(input);

    if (!result.ok) {
      const { error } = result;
      throw new HttpError(STATUS_BY_CODE[error.code], error.code, error.message, error.details);
    }

    const tool: ToolContract = result.value;
    sendData(res, 201, tool);
  };
}
