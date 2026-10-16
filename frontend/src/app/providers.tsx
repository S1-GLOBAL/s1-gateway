import { QueryClientProvider } from '@tanstack/react-query';
import { useState, type ReactNode } from 'react';
import { AccountsGatewayProvider } from '@/features/accounts';
import { ThemeProvider } from '@/features/appearance';
import { AtlasGatewayProvider } from '@/features/atlas';
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
          <AccountsGatewayProvider gateway={dependencies.accountsGateway}>
            <ToolsGatewayProvider gateway={dependencies.toolsGateway}>
              <AtlasGatewayProvider gateway={dependencies.atlasGateway}>{children}</AtlasGatewayProvider>
            </ToolsGatewayProvider>
          </AccountsGatewayProvider>
        </QueryClientProvider>
      </MotionProvider>
    </ThemeProvider>
  );
}