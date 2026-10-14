import { createContext, useContext, type ReactNode } from 'react';
import type { ToolsGateway } from './tools-gateway';

const ToolsGatewayContext = createContext<ToolsGateway | null>(null);

export function ToolsGatewayProvider({ gateway, children }: { gateway: ToolsGateway; children: ReactNode }) {
  return <ToolsGatewayContext value={gateway}>{children}</ToolsGatewayContext>;
}

export function useToolsGateway(): ToolsGateway {
  const gateway = useContext(ToolsGatewayContext);
  if (!gateway) throw new Error('useToolsGateway must be used inside <ToolsGatewayProvider>.');
  return gateway;
}
