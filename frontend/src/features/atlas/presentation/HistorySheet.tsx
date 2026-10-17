import { ArrowRight } from 'lucide-react';
import { useState } from 'react';
import { Badge } from '@/shared/ui/Badge';
import { ErrorState } from '@/shared/ui/ErrorState';
import { SegmentedControl } from '@/shared/ui/SegmentedControl';
import { Sheet } from '@/shared/ui/Sheet';
import { SkeletonText } from '@/shared/ui/Skeleton';
import { useSpecIdHistory } from '../application/use-spec-id-history';
import type { SpecIdChange } from '../domain/atlas';
import { formatChangedAt } from '../domain/format-saved-date';
import { historySentence, inFilter, isRename, type HistoryFilter } from '../domain/history-entry';

export interface HistorySheetProps {
  id: string;
  name: string;
  open: boolean;
  onClose(): void;
  timeZone?: string;
}

/** Every change to a saved Spec ID, newest first, filtered to facts or the name. Asked for only while open. */
export function HistorySheet({ id, name, open, onClose, timeZone }: HistorySheetProps) {
  const history = useSpecIdHistory(id, open);
  const [filter, setFilter] = useState<HistoryFilter>('all');
  const entries = history.data ?? [];
  const count = (value: HistoryFilter) => entries.filter((entry) => inFilter(entry, value)).length;

  return (
    <Sheet open={open} onClose={onClose} title="History" description={`Every change to ${name}, newest first.`}>
      {history.isPending && open && (
        <div className="flex flex-col gap-3">
          {[0, 1, 2].map((line) => (
            <SkeletonText key={line} size="sm" className="w-3/4" order={line} />
          ))}
        </div>
      )}
      {history.error && <ErrorState message={history.error.message} onRetry={() => void history.refetch()} />}
      {history.data && (
        <div className="flex flex-col gap-6">
          <SegmentedControl
            label="Show"
            value={filter}
            options={[
              { value: 'all', label: `All · ${count('all')}` },
              { value: 'facts', label: `Facts · ${count('facts')}` },
              { value: 'name', label: `Name · ${count('name')}` },
            ]}
            onChange={setFilter}
            className="flex-wrap self-start"
          />
          <ol className="flex flex-col gap-4">
            {entries
              .filter((entry) => inFilter(entry, filter))
              .map((entry) => (
                <Entry key={`${entry.changedAt.toISOString()}-${entry.codeAfter}`} entry={entry} timeZone={timeZone} />
              ))}
          </ol>
        </div>
      )}
    </Sheet>
  );
}

function Entry({ entry, timeZone }: { entry: SpecIdChange; timeZone?: string }) {
  const codeChanged = entry.codeBefore !== null && entry.codeBefore !== entry.codeAfter;
  return (
    <li className="flex flex-col gap-3 rounded-surface border border-border p-4">
      <div className="flex flex-col gap-0.5">
        <p className="text-sm font-medium text-ink">{historySentence(entry)}</p>
        <p className="text-xs text-ink-muted">{formatChangedAt(entry.changedAt, timeZone)}</p>
      </div>

      {(entry.slots.length > 0 || isRename(entry)) && (
        <dl className="flex flex-col gap-2 text-sm">
          {isRename(entry) && <Change name="Name" before={entry.nameBefore ?? ''} after={entry.nameAfter} />}
          {entry.slots.map((slot) => (
            <Change key={slot.key} name={slot.name} before={slot.before} after={slot.after} corrected={slot.corrected} />
          ))}
        </dl>
      )}

      <p className="flex flex-col gap-1 font-mono text-xs break-all text-ink-muted">
        {codeChanged && <span className="line-through">{entry.codeBefore}</span>}
        <span className="text-ink">{entry.codeAfter}</span>
      </p>
    </li>
  );
}

function Change({ name, before, after, corrected = false }: { name: string; before: string; after: string; corrected?: boolean }) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="flex items-center gap-2 text-xs text-ink-muted">
        {name}
        {corrected && <Badge tone="info">Corrected</Badge>}
      </dt>
      <dd className="flex flex-wrap items-center gap-1.5 text-ink">
        <span className="min-w-0 break-words text-ink-muted line-through">{before}</span>
        <ArrowRight size={14} strokeWidth={1.75} aria-hidden="true" className="text-ink-subtle" />
        <span className="sr-only">to</span>
        <span className="min-w-0 break-words">{after}</span>
      </dd>
    </div>
  );
}
