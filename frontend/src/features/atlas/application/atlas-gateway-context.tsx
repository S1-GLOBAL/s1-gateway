import { createContext, useContext, type ReactNode } from 'react';
import type { AtlasGateway } from './atlas-gateway';

const AtlasGatewayContext = createContext<AtlasGateway | null>(null);

export function AtlasGatewayProvider({ gateway, children }: { gateway: AtlasGateway; children: ReactNode }) {
  return <AtlasGatewayContext value={gateway}>{children}</AtlasGatewayContext>;
}

export function useAtlasGateway(): AtlasGateway {
  const gateway = useContext(AtlasGatewayContext);
  if (!gateway) throw new Error('useAtlasGateway must be used inside <AtlasGatewayProvider>.');
  return gateway;
}
