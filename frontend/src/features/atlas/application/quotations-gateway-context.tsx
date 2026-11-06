import { createContext, useContext, type ReactNode } from 'react';
import type { QuotationsGateway } from './quotations-gateway';

const QuotationsGatewayContext = createContext<QuotationsGateway | null>(null);

export function QuotationsGatewayProvider({ gateway, children }: { gateway: QuotationsGateway; children: ReactNode }) {
  return <QuotationsGatewayContext value={gateway}>{children}</QuotationsGatewayContext>;
}

export function useQuotationsGateway(): QuotationsGateway {
  const gateway = useContext(QuotationsGatewayContext);
  if (!gateway) throw new Error('useQuotationsGateway must be used inside <QuotationsGatewayProvider>.');
  return gateway;
}
