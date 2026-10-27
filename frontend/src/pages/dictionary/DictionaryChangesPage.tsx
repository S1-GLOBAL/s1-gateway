import { useMe } from '@/features/accounts';
import { DictionaryChanges } from '@/features/atlas';
import { PageHeader } from '@/shared/ui/PageHeader';

/** Every suggested change to the Atlas dictionary, for everyone signed in (#95). */
export function DictionaryChangesPage() {
  const { data: me } = useMe();

  return (
    <div className="flex flex-col gap-10">
      <PageHeader
        title="Dictionary changes"
        description="Suggested changes to the Atlas dictionary wait here for an admin. Each decision stays, with its trail."
      />
      <DictionaryChanges viewer={{ id: me.id, isAdmin: me.isAdmin }} />
    </div>
  );
}
