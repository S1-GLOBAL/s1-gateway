import { Link, useLocation, useParams } from 'react-router-dom';
import { SpecIdEditor, useDictionary, useSavedSpecId, type SavedNotice } from '@/features/atlas';

/** `/atlas/:id`: one saved Spec ID, open for change. */
export function SpecIdPage() {
  const { id = '' } = useParams();
  const location = useLocation();
  const { data: dictionary } = useDictionary();
  const { data: saved, refetch } = useSavedSpecId(id);
  const arrival = (location.state as Partial<SavedNotice> | null)?.notice;

  if (!saved) {
    return (
      <div className="flex flex-col items-start gap-4 py-16">
        <h1 className="text-xl font-semibold text-ink">This Spec ID doesn't exist. It may have been typed wrong.</h1>
        <Link
          to="/atlas"
          className="inline-flex h-10 items-center rounded-control border border-border-strong bg-surface px-4 text-sm font-medium text-ink shadow-sm transition-colors duration-150 ease-standard hover:bg-surface-raised"
        >
          Back to Atlas
        </Link>
      </div>
    );
  }

  return (
    <SpecIdEditor
      key={saved.id}
      dictionary={dictionary}
      saved={saved}
      onReload={async () => (await refetch()).data ?? null}
      notice={arrival}
    />
  );
}
