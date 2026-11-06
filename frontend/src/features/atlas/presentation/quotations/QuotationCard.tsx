import { useId, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { Badge } from '@/shared/ui/Badge';
import { Button } from '@/shared/ui/Button';
import { Card } from '@/shared/ui/Card';
import { ErrorState } from '@/shared/ui/ErrorState';
import { Sheet } from '@/shared/ui/Sheet';
import { SkeletonText } from '@/shared/ui/Skeleton';
import { TextField } from '@/shared/ui/TextField';
import { useApproveQuotation, useQuotation, useRejectQuotation, useWithdrawQuotation } from '../../application/use-quotations';
import { formatChangedAt } from '../../domain/format-saved-date';
import { QUOTATION_FIELDS, quotationActions, quotationStateLine, type Quotation, type QuotationEvent } from '../../domain/quotation';
import { QuotationForm } from './QuotationForm';

export interface Viewer {
  id: string;
  isAdmin: boolean;
}

export interface QuotationCardProps {
  quotation: Quotation;
  viewer: Viewer;
  /** Names the Spec ID it quotes, linking to its manufacturers: on Quotation Changes, not on that Spec ID's own screen. */
  showSpecId?: boolean;
  timeZone?: string;
  /** Says what just happened, once this card's action succeeds. */
  onNotice(message: string): void;
}

const VERBS: Record<QuotationEvent['kind'], string> = {
  suggested: 'Added',
  edited: 'Edited',
  withdrawn: 'Withdrawn',
  approved: 'Approved',
  rejected: 'Rejected',
};

/**
 * One quotation (plan 0017): its manufacturer, its values, where it stands,
 * and what the viewer may do with it. Whoever added it edits or withdraws it
 * while it waits; an admin who did not add it approves or rejects it.
 */
export function QuotationCard({ quotation, viewer, showSpecId = false, timeZone, onNotice }: QuotationCardProps) {
  const titleId = useId();
  const actions = quotationActions(quotation, viewer);
  const approve = useApproveQuotation();
  const withdraw = useWithdrawQuotation();
  const [rejecting, setRejecting] = useState(false);
  const [editing, setEditing] = useState(false);
  const [trailOpen, setTrailOpen] = useState(false);
  const failure = approve.error ?? withdraw.error;
  const { manufacturer } = quotation;
  const given = QUOTATION_FIELDS.filter(({ key }) => key !== 'itemName' && quotation.values[key] !== null);

  // The card may leave its list once decided, before the request settles: awaiting, not a callback, says so.
  async function approveIt() {
    try {
      await approve.mutateAsync({ id: quotation.id, version: quotation.version });
      onNotice(`Approved. The quote from ${manufacturer.name} is now among the Spec ID's quotes.`);
    } catch {
      // The answer is shown from `approve.error`.
    }
  }

  async function withdrawIt() {
    try {
      await withdraw.mutateAsync({ id: quotation.id });
      onNotice('Withdrawn.');
    } catch {
      // The answer is shown from `withdraw.error`.
    }
  }

  return (
    <Card aria-labelledby={titleId} className="flex flex-col gap-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 flex-col gap-0.5">
          {showSpecId && (
            <Link
              to={`/atlas/${quotation.specId}/manufacturers`}
              className="self-start text-sm break-words text-accent-ink underline-offset-4 hover:underline"
            >
              {quotation.specName} <span className="font-mono">{quotation.specCode}</span>
            </Link>
          )}
          {/* The badge sits beside the name, not in it, so the card is named by its manufacturer alone. */}
          <div className="flex flex-wrap items-center gap-2">
            <h3 id={titleId} className="text-md font-medium break-words text-ink">
              {manufacturer.name}
            </h3>
            {manufacturer.kind === 'new' && <Badge tone="info">New manufacturer</Badge>}
          </div>
          {manufacturer.country && <p className="text-sm text-ink-muted">{manufacturer.country}</p>}
          <p className="text-xs text-ink-subtle">
            Added by {quotation.suggestedBy.fullName}, {formatChangedAt(quotation.suggestedAt, timeZone)}
          </p>
        </div>
        <span className="shrink-0 self-start">
          <StateBadge state={quotation.state} />
        </span>
      </div>

      <div className="flex flex-col gap-3 rounded-control bg-surface-sunken p-3">
        {quotation.values.itemName !== null && <p className="text-sm font-medium break-words text-ink">{quotation.values.itemName}</p>}
        <dl className="grid grid-cols-2 gap-x-6 gap-y-2 sm:grid-cols-3 lg:grid-cols-4">
          {given.map(({ key, label }) => (
            <div key={key} className="flex min-w-0 flex-col">
              <dt className="text-xs text-ink-subtle">{label}</dt>
              <dd className="font-mono text-sm break-words text-ink">{quotation.values[key]}</dd>
            </div>
          ))}
        </dl>
      </div>

      {(quotation.state !== 'waiting' || !actions.decide) && <p className="text-sm text-ink">{quotationStateLine(quotation)}</p>}
      {failure && (
        <p role="alert" className="text-sm text-danger">
          {failure.message}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-2">
        {actions.decide && (
          <>
            <Button loading={approve.isPending} onClick={approveIt}>
              Approve
            </Button>
            <Button variant="secondary" onClick={() => setRejecting(true)}>
              Reject
            </Button>
          </>
        )}
        {actions.edit && (
          <Button variant="secondary" onClick={() => setEditing(true)}>
            Edit
          </Button>
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

      {trailOpen && <Trail id={quotation.id} timeZone={timeZone} />}

      {actions.edit && (
        <QuotationForm
          // Opened afresh each time, from the quotation as it asks now.
          key={`${quotation.version}-${editing}`}
          specId={quotation.specId}
          open={editing}
          editing={quotation}
          onClose={() => setEditing(false)}
          onSent={(message) => {
            setEditing(false);
            onNotice(message);
          }}
        />
      )}

      {actions.decide && (
        <RejectQuotation
          quotation={quotation}
          open={rejecting}
          onClose={() => setRejecting(false)}
          onRejected={() => {
            setRejecting(false);
            onNotice(`Rejected. ${quotation.suggestedBy.fullName} sees your reason.`);
          }}
        />
      )}
    </Card>
  );
}

function StateBadge({ state }: { state: Quotation['state'] }) {
  switch (state) {
    case 'waiting':
      return <Badge tone="warning">Waiting</Badge>;
    case 'approved':
      return <Badge tone="success">Approved</Badge>;
    case 'rejected':
      return <Badge tone="danger">Rejected</Badge>;
    case 'withdrawn':
      return <Badge>Withdrawn</Badge>;
  }
}

/** Every step of a quotation, first first: who and when, and why it was rejected. Asked for once opened. */
function Trail({ id, timeZone }: { id: string; timeZone?: string }) {
  const detail = useQuotation(id, true);
  if (detail.isPending) return <SkeletonText size="sm" className="w-64" />;
  if (detail.isError) return <ErrorState message={detail.error.message} onRetry={() => void detail.refetch()} />;
  return (
    <ol aria-label="Trail" className="flex flex-col gap-3">
      {detail.data.trail.map((event) => (
        <li key={`${event.kind}-${event.at.toISOString()}`} className="flex flex-col gap-1.5 border-l-2 border-border pl-3">
          <p className="text-sm text-ink">
            <span className="font-medium">{VERBS[event.kind]}</span> by {event.by.fullName}
          </p>
          <p className="text-xs text-ink-subtle">{formatChangedAt(event.at, timeZone)}</p>
          {event.reason && <p className="text-sm text-ink-muted">{event.reason}</p>}
        </li>
      ))}
    </ol>
  );
}

/** Rejecting a quotation, with the reason whoever added it reads. The server checks the reason. */
function RejectQuotation({ quotation, open, onClose, onRejected }: { quotation: Quotation; open: boolean; onClose(): void; onRejected(): void }) {
  const reject = useRejectQuotation();
  const [reason, setReason] = useState('');
  const reasonErrors = reject.error?.fields.reason;

  async function submit(event: FormEvent) {
    event.preventDefault();
    try {
      await reject.mutateAsync({ id: quotation.id, reason });
      setReason('');
      onRejected();
    } catch {
      // The answer is shown from `reject.error`.
    }
  }

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={`Reject the quotation from ${quotation.manufacturer.name}`}
      description={`${quotation.suggestedBy.fullName} sees your reason.`}
    >
      <form noValidate onSubmit={submit} className="flex flex-col gap-5">
        <TextField label="Reason" name="reason" value={reason} onChange={(event) => setReason(event.target.value)} errors={reasonErrors} />
        {reject.error && !reasonErrors && (
          <p role="alert" className="text-sm text-danger">
            {reject.error.message}
          </p>
        )}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" variant="danger" loading={reject.isPending}>
            Reject
          </Button>
        </div>
      </form>
    </Sheet>
  );
}
