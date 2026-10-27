import { createContext, useContext, type ReactNode } from 'react';
import type { SuggestionsGateway } from './suggestions-gateway';

const SuggestionsGatewayContext = createContext<SuggestionsGateway | null>(null);

export function SuggestionsGatewayProvider({ gateway, children }: { gateway: SuggestionsGateway; children: ReactNode }) {
  return <SuggestionsGatewayContext value={gateway}>{children}</SuggestionsGatewayContext>;
}

export function useSuggestionsGateway(): SuggestionsGateway {
  const gateway = useContext(SuggestionsGatewayContext);
  if (!gateway) throw new Error('useSuggestionsGateway must be used inside <SuggestionsGatewayProvider>.');
  return gateway;
}
