import { formatChangedAt } from '../../domain/format-saved-date';
import { editedFields, type SuggestionEvent } from '../../domain/suggestion';
import { ChangeLine } from './ChangeLine';

const VERBS: Record<SuggestionEvent['kind'], string> = {
  suggested: 'Suggested',
  edited: 'Edited',
  withdrawn: 'Withdrawn',
  approved: 'Approved',
  rejected: 'Rejected',
};

/** Every step of a suggestion, first step first: who, when, what an edit changed, and why it was rejected (#95). */
export function SuggestionTrail({ events, timeZone }: { events: readonly SuggestionEvent[]; timeZone?: string }) {
  return (
    <ol aria-label="Trail" className="flex flex-col gap-3">
      {events.map((event) => {
        const changes = event.proposalBefore && event.proposalAfter ? editedFields(event.proposalBefore, event.proposalAfter) : [];
        return (
          <li key={`${event.kind}-${event.at.toISOString()}`} className="flex flex-col gap-1.5 border-l-2 border-border pl-3">
            <p className="text-sm text-ink">
              <span className="font-medium">{VERBS[event.kind]}</span> by {event.by.fullName}
            </p>
            <p className="text-xs text-ink-subtle">{formatChangedAt(event.at, timeZone)}</p>
            {changes.length > 0 && (
              <dl className="flex flex-col gap-2 text-sm">
                {changes.map((change) => (
                  <ChangeLine key={change.label} change={change} />
                ))}
              </dl>
            )}
            {event.reason && <p className="text-sm text-ink-muted">{event.reason}</p>}
          </li>
        );
      })}
    </ol>
  );
}
