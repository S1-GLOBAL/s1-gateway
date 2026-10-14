import { QueryClientProvider } from '@tanstack/react-query';
import { useState, type ReactNode } from 'react';
import { ToolsGatewayProvider } from '@/features/tools';
import { createDependencies } from './dependencies';
import { createQueryClient } from './query-client';

export function AppProviders({ children }: { children: ReactNode }) {
  const [queryClient] = useState(createQueryClient);
  const [dependencies] = useState(createDependencies);

  return (
    <QueryClientProvider client={queryClient}>
      <ToolsGatewayProvider gateway={dependencies.toolsGateway}>{children}</ToolsGatewayProvider>
    </QueryClientProvider>
  );
}
