import { useState } from 'react';
import { Badge } from '@/shared/ui/Badge';
import type { SavedSpecId } from '../../domain/atlas';
import { formatSavedDate } from '../../domain/format-saved-date';
import { notKnownCount, summarise } from '../../domain/spec-id-summary';
import { StageIcons } from './StageIcons';

/**
 * A saved Spec ID at a glance: name, code, its known facts in plain words,
 * how far its manufacturers have come (#73), what is missing, and its last
 * change.
 */
export function SpecIdSummary({ saved, timeZone }: { saved: SavedSpecId; timeZone?: string }) {
  const missing = notKnownCount(saved);
  // Each hover mounts the stage icons again, so lit icons replay their one-time arrival.
  const [hovers, setHovers] = useState(0);
  return (
    <div className="flex min-w-0 flex-col gap-2" onMouseEnter={() => setHovers((n) => n + 1)}>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <p className="min-w-0 text-md font-medium break-words text-ink">{saved.name}</p>
        {missing > 0 ? <Badge tone="warning">{`${missing} not known`}</Badge> : <Badge tone="accent">Complete</Badge>}
      </div>
      <p className="font-mono text-sm break-all text-ink-muted">{saved.code}</p>
      <p className="text-sm break-words text-ink">{summarise(saved)}</p>
      {saved.manufacturerStages && <StageIcons key={hovers} counts={saved.manufacturerStages} />}
      <p className="text-xs text-ink-muted">
        {`Last updated by ${(saved.updatedBy ?? saved.savedBy).fullName} on ${formatSavedDate(saved.updatedAt ?? saved.savedAt, timeZone)}`}
      </p>
    </div>
  );
}
