import { useState } from 'react';
import { Badge } from '@/shared/ui/Badge';
import type { SavedSpecId } from '../../domain/atlas';
import { formatSavedDate } from '../../domain/format-saved-date';
import { notKnownCount, summarise } from '../../domain/spec-id-summary';
import { CopyCodeButton } from './CopyCodeButton';
import { StageIcons } from './StageIcons';

/**
 * A saved Spec ID at a glance: name, code, its known facts in plain words,
 * how far its manufacturers have come (#73), what is missing, and its last
 * change. The code can be copied without leaving the card.
 */
export function SpecIdSummary({
  saved,
  timeZone,
  hovers: hoversFromCard,
}: {
  saved: SavedSpecId;
  timeZone?: string;
  /** Set by a card whose link covers this summary, so a hover still replays the stage icons. */
  hovers?: number;
}) {
  const missing = notKnownCount(saved);
  // Each hover mounts the stage icons again, so lit icons replay their one-time arrival.
  const [ownHovers, setOwnHovers] = useState(0);
  const hovers = hoversFromCard ?? ownHovers;
  return (
    <div
      className="flex min-w-0 flex-col gap-2"
      onMouseEnter={hoversFromCard === undefined ? () => setOwnHovers((n) => n + 1) : undefined}
    >
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <p id={`spec-${saved.id}-name`} className="min-w-0 text-md font-medium break-words text-ink">
          {saved.name}
        </p>
        {missing > 0 ? <Badge tone="warning">{`${missing} not known`}</Badge> : <Badge tone="accent">Complete</Badge>}
      </div>
      <div className="flex min-w-0 items-start gap-2">
        <p className="pointer-events-auto min-w-0 flex-1 font-mono text-sm break-all text-ink-muted">{saved.code}</p>
        <CopyCodeButton code={saved.code} />
      </div>
      <p className="text-sm break-words text-ink">{summarise(saved)}</p>
      {saved.manufacturerStages && <StageIcons key={hovers} counts={saved.manufacturerStages} />}
      <p className="text-xs text-ink-muted">
        {`Last updated by ${(saved.updatedBy ?? saved.savedBy).fullName} on ${formatSavedDate(saved.updatedAt ?? saved.savedAt, timeZone)}`}
      </p>
    </div>
  );
}
