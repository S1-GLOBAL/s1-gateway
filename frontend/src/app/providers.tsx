import { QueryClientProvider } from '@tanstack/react-query';
import { useState, type ReactNode } from 'react';
import { ThemeProvider } from '@/features/appearance';
import { ToolsGatewayProvider } from '@/features/tools';
import { createDependencies } from './dependencies';
import { MotionProvider } from './motion-provider';
import { createQueryClient } from './query-client';

export function AppProviders({ children }: { children: ReactNode }) {
  const [queryClient] = useState(createQueryClient);
  const [dependencies] = useState(createDependencies);

  return (
    <ThemeProvider store={dependencies.themeStore} document={dependencies.themeDocument}>
      <MotionProvider>
        <QueryClientProvider client={queryClient}>
          <ToolsGatewayProvider gateway={dependencies.toolsGateway}>{children}</ToolsGatewayProvider>
        </QueryClientProvider>
      </MotionProvider>
    </ThemeProvider>
  );
}
