import { useSearchParams } from 'react-router-dom';
import { useMe } from '@/features/accounts';
import { DictionaryChanges } from '@/features/atlas';
import { PageHeader } from '@/shared/ui/PageHeader';

/**
 * Every suggested change to the Atlas dictionary, for everyone signed in
 * (#95). `?change=N`, from a Spec ID's history, opens the history on change N.
 */
export function DictionaryChangesPage() {
  const { data: me } = useMe();
  const [params] = useSearchParams();
  const asked = Number(params.get('change'));
  const change = Number.isInteger(asked) && asked > 0 ? asked : null;

  return (
    <div className="flex flex-col gap-10">
      <PageHeader
        title="Dictionary Changes"
        description="Suggested changes to the Atlas dictionary wait here for an admin. Each decision stays, with its trail."
      />
      <DictionaryChanges viewer={{ id: me.id, isAdmin: me.isAdmin }} change={change} />
    </div>
  );
}
