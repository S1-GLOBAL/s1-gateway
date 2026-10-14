import { useQuery } from '@tanstack/react-query';
import type { AppError } from '@/shared/application/app-error';
import type { Tool } from '../domain/tool';
import { useToolsGateway } from './tools-gateway-context';
import { toolsKeys } from './tools.keys';

export function useTools() {
  const gateway = useToolsGateway();
  return useQuery<Tool[], AppError>({
    queryKey: toolsKeys.list(),
    queryFn: () => gateway.list(),
  });
}
