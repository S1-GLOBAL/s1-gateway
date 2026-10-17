import { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { AccountsManager, useMe } from '@/features/accounts';
import { Button } from '@/shared/ui/Button';
import { PlusIcon } from '@/shared/ui/icons';
import { PageHeader } from '@/shared/ui/PageHeader';

export function AccountsPage() {
  const { data: me } = useMe();
  const [inviting, setInviting] = useState(false);
  // Never ask the API for the lists: it would only answer 403.
  if (!me.isAdmin) return <Navigate to="/atlas" replace />;

  return (
    <div className="flex flex-col gap-10">
      <PageHeader
        title="Accounts"
        description="Approve new staff, give someone a way back in, or end their access."
        action={
          <Button onClick={() => setInviting(true)}>
            <PlusIcon size={16} />
            Invite
          </Button>
        }
      />
      <AccountsManager inviting={inviting} onInvitingEnd={() => setInviting(false)} />
    </div>
  );
}
