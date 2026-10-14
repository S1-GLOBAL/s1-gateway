import { HttpToolsGateway, type ToolsGateway } from '@/features/tools';
import { createHttpClient } from '@/shared/infrastructure/http-client';

/** Every port's production adapter, chosen in one place. */
export interface Dependencies {
  toolsGateway: ToolsGateway;
}

export function createDependencies(): Dependencies {
  const http = createHttpClient(import.meta.env.VITE_API_URL ?? '/api/v1');
  return { toolsGateway: new HttpToolsGateway(http) };
}
