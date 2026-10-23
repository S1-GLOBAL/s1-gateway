import { Link, useParams } from 'react-router-dom';
import { useMe } from '@/features/accounts';
import { BackToAtlas, ManufacturerGroups, useSpecIdManufacturers } from '@/features/atlas';
import { EmptyState } from '@/shared/ui/EmptyState';
import { NoManufacturersIcon } from '@/shared/ui/icons';

const SECONDARY_LINK =
  'inline-flex h-10 items-center rounded-control border border-border-strong bg-surface px-4 text-sm font-medium text-ink shadow-sm transition-colors duration-150 ease-standard hover:bg-surface-raised';

/**
 * `/atlas/:id/manufacturers`: who has worked on this product, grouped from
 * Specifications received to In production (#57). The Spec ID page is one
 * click away.
 */
export function ManufacturersPage() {
  const { id = '' } = useParams();
  const { data } = useSpecIdManufacturers(id);
  const { data: me } = useMe();

  if (!data) {
    return (
      <div className="flex flex-col items-start gap-4 py-16">
        <h1 className="text-xl font-semibold text-ink">This Spec ID doesn't exist. It may have been typed wrong.</h1>
        <Link to="/atlas" className={SECONDARY_LINK}>
          Back to Atlas
        </Link>
      </div>
    );
  }

  const openSpecId = (
    <Link to={`/atlas/${data.specId.id}`} className={SECONDARY_LINK}>
      Open Spec ID
    </Link>
  );

  return (
    <div className="flex flex-col gap-10">
      <div className="flex flex-col gap-4">
        <BackToAtlas />
        <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex min-w-0 flex-col gap-1">
            <p className="text-2xs font-medium text-ink-subtle uppercase">Manufacturers</p>
            <h1 className="text-xl font-semibold break-words text-ink">{data.specId.name}</h1>
            <p className="font-mono text-sm break-all text-ink-muted">{data.specId.code}</p>
          </div>
          <div className="shrink-0">{openSpecId}</div>
        </header>
      </div>
      {data.manufacturers.length === 0 ? (
        <EmptyState
          icon={<NoManufacturersIcon size={24} />}
          title="No manufacturers are recorded for this Spec ID yet."
          description="They come from the verified list import."
          action={openSpecId}
        />
      ) : (
        <ManufacturerGroups specId={data.specId.id} manufacturers={data.manufacturers} isAdmin={me.isAdmin} />
      )}
    </div>
  );
}
