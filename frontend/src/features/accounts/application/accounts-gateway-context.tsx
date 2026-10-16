import { createContext, useContext, type ReactNode } from 'react';
import type { AccountsGateway } from './accounts-gateway';

const AccountsGatewayContext = createContext<AccountsGateway | null>(null);

export function AccountsGatewayProvider({
  gateway,
  children,
}: {
  gateway: AccountsGateway;
  children: ReactNode;
}) {
  return <AccountsGatewayContext value={gateway}>{children}</AccountsGatewayContext>;
}

export function useAccountsGateway(): AccountsGateway {
  const gateway = useContext(AccountsGatewayContext);
  if (!gateway) throw new Error('useAccountsGateway must be used inside <AccountsGatewayProvider>.');
  return gateway;
}
