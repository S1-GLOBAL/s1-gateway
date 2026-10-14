import { useSuspenseQuery } from '@tanstack/react-query';
import type { AppError } from '@/shared/application/app-error';
import type { Tool } from '../domain/tool';
import { useToolsGateway } from './tools-gateway-context';
import { toolsKeys } from './tools.keys';

/**
 * Suspends until the tools arrive, so the route's skeleton covers both the
 * page's code and its data (ADR 0013). A failure is thrown to the nearest
 * error boundary.
 */
export function useTools() {
  const gateway = useToolsGateway();
  return useSuspenseQuery<Tool[], AppError>({
    queryKey: toolsKeys.list(),
    queryFn: () => gateway.list(),
  });
}
