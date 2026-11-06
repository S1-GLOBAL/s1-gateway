import { useMe } from '@/features/accounts';
import { QuotationChanges } from '@/features/atlas';
import { PageHeader } from '@/shared/ui/PageHeader';

/** Every quotation added in Atlas, for everyone signed in (plan 0017): those waiting for an admin, and the history. */
export function QuotationChangesPage() {
  const { data: me } = useMe();
  return (
    <div className="flex flex-col gap-10">
      <PageHeader
        title="Quotation Changes"
        description="Quotations added to a Spec ID wait here for an admin. Each decision stays, with its trail."
      />
      <QuotationChanges viewer={{ id: me.id, isAdmin: me.isAdmin }} />
    </div>
  );
}
