import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { AppError } from '@/shared/application/app-error';
import type { NewTool, Tool } from '../domain/tool';
import { useToolsGateway } from './tools-gateway-context';
import { toolsKeys } from './tools.keys';

export function useCreateTool() {
  const gateway = useToolsGateway();
  const queryClient = useQueryClient();
  return useMutation<Tool, AppError, NewTool>({
    mutationFn: (input) => gateway.create(input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: toolsKeys.all }),
  });
}
