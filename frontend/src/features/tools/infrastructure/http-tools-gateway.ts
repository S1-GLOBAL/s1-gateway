import type { DataEnvelope } from '@contracts/envelope';
import type { CreateToolRequest, Tool as ToolContract } from '@contracts/tools';
import type { AxiosInstance } from 'axios';
import { toAppError } from '@/shared/infrastructure/to-app-error';
import type { ToolsGateway } from '../application/tools-gateway';
import type { NewTool, Tool } from '../domain/tool';

/** The ToolsGateway port over the HTTP API. The only file in the feature that knows the wire format. */
export class HttpToolsGateway implements ToolsGateway {
  private readonly http: AxiosInstance;

  constructor(http: AxiosInstance) {
    this.http = http;
  }

  async list(): Promise<Tool[]> {
    try {
      const response = await this.http.get<DataEnvelope<ToolContract[]>>('/tools');
      return response.data.data.map(toDomain);
    } catch (error) {
      throw toAppError(error);
    }
  }

  async create(input: NewTool): Promise<Tool> {
    const body: CreateToolRequest = {
      name: input.name,
      url: input.url,
      description: input.description,
      category: input.category,
    };
    try {
      const response = await this.http.post<DataEnvelope<ToolContract>>('/tools', body);
      return toDomain(response.data.data);
    } catch (error) {
      throw toAppError(error);
    }
  }
}

function toDomain(contract: ToolContract): Tool {
  return { ...contract, createdAt: new Date(contract.createdAt) };
}
