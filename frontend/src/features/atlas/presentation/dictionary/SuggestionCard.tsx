import { useId, useState } from 'react';
import { Badge } from '@/shared/ui/Badge';
import { Button } from '@/shared/ui/Button';
import { Card } from '@/shared/ui/Card';
import { ErrorState } from '@/shared/ui/ErrorState';
import { SkeletonText } from '@/shared/ui/Skeleton';
import { useApproveSuggestion, useWithdrawSuggestion } from '../../application/use-decide-suggestion';
import { useSuggestion } from '../../application/use-suggestions';
import type { AtlasDictionary } from '../../domain/atlas';
import { formatChangedAt } from '../../domain/format-saved-date';
import {
  actionsFor,
  approvedLine,
  describeSuggestion,
  stateLine,
  usageLine,
  type Rewrite,
  type Suggestion,
  type SuggestionDetail,
} from '../../domain/suggestion';
import { ChangeLine } from './ChangeLine';
import { RejectForm } from './RejectForm';
import { SuggestionTrail } from './SuggestionTrail';

/** How many rewritten codes a card lists before it only counts the rest. */
const REWRITES_SHOWN = 5;

export interface Viewer {
  id: string;
  isAdmin: boolean;
}

export interface SuggestionCardProps {
  suggestion: Suggestion;
  /** In full while it waits: its use, what approving would rewrite, and its trail. Null for a decided one, whose trail loads when opened. */
  detail: SuggestionDetail | null;
  dictionary: AtlasDictionary;
  viewer: Viewer;
  timeZone?: string;
  /** Says what just happened, once this card's action succeeds. */
  onNotice(message: string): void;
}

/**
 * One suggestion: what it changes, before and after; how many saved Spec IDs
 * hold the option and which codes approving would change; where it stands;
 * and what the viewer may do with it (#95). The suggester may withdraw it; an
 * admin who did not suggest it approves or rejects it.
 */
export function SuggestionCard({ suggestion, detail, dictionary, viewer, timeZone, onNotice }: SuggestionCardProps) {
  const titleId = useId();
  const summary = describeSuggestion(suggestion, dictionary);
  const actions = actionsFor(suggestion, viewer);
  const approve = useApproveSuggestion();
  const withdraw = useWithdrawSuggestion();
  const [rejecting, setRejecting] = useState(false);
  const [trailOpen, setTrailOpen] = useState(false);
  const failure = approve.error ?? withdraw.error;
  const usage = detail ? usageLine(detail.usage, suggestion.proposal) : null;
  const problem = actions.decide ? (detail?.problem ?? null) : null;

  // A decided card leaves the list, often before its request settles, and a
  // `mutate` callback never runs once its card has gone; awaiting does.
  async function approveIt() {
    try {
      onNotice(approvedLine(await approve.mutateAsync({ id: suggestion.id, version: suggestion.version })));
    } catch {
      // The answer is shown from `approve.error`.
    }
  }

  async function withdrawIt() {
    try {
      await withdraw.mutateAsync({ id: suggestion.id });
      onNotice('Withdrawn.');
    } catch {
      // The answer is shown from `withdraw.error`.
    }
  }

  return (
    <Card aria-labelledby={titleId} className="flex flex-col gap-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 flex-col gap-0.5">
          <h3 id={titleId} className="text-md text-ink">
            {summary.title}
          </h3>
          <p className="text-xs text-ink-subtle">
            Suggested by {suggestion.suggestedBy.fullName}, {formatChangedAt(suggestion.suggestedAt, timeZone)}
          </p>
        </div>
        <span className="shrink-0 self-start">
          <StateBadge suggestion={suggestion} />
        </span>
      </div>

      {summary.rows.length > 0 && (
        <dl className="flex flex-col gap-2 text-sm">
          {summary.rows.map((row) => (
            <ChangeLine key={row.label} change={row} />
          ))}
        </dl>
      )}

      {usage && <p className="text-sm text-ink-muted">{usage}</p>}
      {detail?.rewrites && detail.rewrites.length > 0 && <Rewrites rewrites={detail.rewrites} />}

      {(suggestion.state !== 'waiting' || !actions.decide) && <p className="text-sm text-ink">{stateLine(suggestion)}</p>}
      {problem && <p className="rounded-control bg-warning-soft px-3 py-2 text-sm text-warning">{problem}</p>}
      {failure && (
        <p role="alert" className="text-sm text-danger">
          {failure.message}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-2">
        {actions.decide && (
          <>
            <Button loading={approve.isPending} disabled={problem !== null} onClick={approveIt}>
              Approve
            </Button>
            <Button variant="secondary" onClick={() => setRejecting(true)}>
              Reject
            </Button>
          </>
        )}
        {actions.withdraw && (
          <Button variant="secondary" loading={withdraw.isPending} onClick={withdrawIt}>
            Withdraw
          </Button>
        )}
        <Button variant="ghost" aria-expanded={trailOpen} onClick={() => setTrailOpen((open) => !open)}>
          {trailOpen ? 'Hide trail' : 'Show trail'}
        </Button>
      </div>

      {trailOpen &&
        (detail ? <SuggestionTrail events={detail.events} timeZone={timeZone} /> : <LoadedTrail id={suggestion.id} timeZone={timeZone} />)}

      {actions.decide && (
        <RejectForm
          suggestion={suggestion}
          open={rejecting}
          onClose={() => setRejecting(false)}
          onRejected={() => {
            setRejecting(false);
            onNotice(`Rejected. ${suggestion.suggestedBy.fullName} sees your reason.`);
          }}
        />
      )}
    </Card>
  );
}

function StateBadge({ suggestion }: { suggestion: Suggestion }) {
  switch (suggestion.state) {
    case 'waiting':
      return <Badge tone="warning">Waiting</Badge>;
    case 'approved':
      return <Badge tone="success">Change #{suggestion.changeNumber}</Badge>;
    case 'rejected':
      return <Badge tone="danger">Rejected</Badge>;
    case 'withdrawn':
      return <Badge>Withdrawn</Badge>;
  }
}

function Rewrites({ rewrites }: { rewrites: readonly Rewrite[] }) {
  const more = rewrites.length - REWRITES_SHOWN;
  return (
    <div className="flex flex-col gap-2">
      <p className="text-xs text-ink-muted">Codes approving changes</p>
      <ul className="flex flex-col gap-2">
        {rewrites.slice(0, REWRITES_SHOWN).map((rewrite) => (
          <li key={rewrite.id} className="flex flex-col gap-0.5 rounded-control bg-surface-sunken px-3 py-2">
            <span className="text-sm text-ink">{rewrite.name}</span>
            <span className="font-mono text-xs break-all text-ink-muted line-through">{rewrite.codeBefore}</span>
            <span className="sr-only">to</span>
            <span className="font-mono text-xs break-all text-ink">{rewrite.codeAfter}</span>
          </li>
        ))}
      </ul>
      {more > 0 && <p className="text-xs text-ink-muted">and {more} more</p>}
    </div>
  );
}

/** A decided suggestion's trail, asked for when it is first opened. */
function LoadedTrail({ id, timeZone }: { id: string; timeZone?: string }) {
  const trail = useSuggestion(id, true);
  if (trail.error) return <ErrorState message={trail.error.message} onRetry={() => void trail.refetch()} />;
  if (!trail.data) {
    return (
      <div className="flex flex-col gap-2" aria-busy="true">
        {[0, 1].map((line) => (
          <SkeletonText key={line} size="sm" className="w-2/3" order={line} />
        ))}
      </div>
    );
  }
  return <SuggestionTrail events={trail.data.events} timeZone={timeZone} />;
}
