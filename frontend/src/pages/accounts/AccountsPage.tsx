import { Navigate } from 'react-router-dom';
import { AccountsManager, useMe } from '@/features/accounts';
import { PageHeader } from '@/shared/ui/PageHeader';

export function AccountsPage() {
  const { data: me } = useMe();
  // Never ask the API for the lists: it would only answer 403.
  if (!me.isAdmin) return <Navigate to="/theme" replace />;

  return (
    <div className="flex flex-col gap-10">
      <PageHeader title="Accounts" description="Approve new staff, give someone a way back in, or end their access." />
      <AccountsManager />
    </div>
  );
}