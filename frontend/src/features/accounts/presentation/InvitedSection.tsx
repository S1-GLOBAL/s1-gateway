import { Badge } from '@/shared/ui/Badge';
import { Button } from '@/shared/ui/Button';
import type { AccountInvite } from '../domain/account';
import { formatDay } from '../domain/format-day';

export interface InvitedSectionProps {
  invites: readonly AccountInvite[];
  /** Stops a second press while an action is under way. */
  busy: boolean;
  onRevoke(invite: AccountInvite): void;
  /** The viewer's own when left out; tests fix one. */
  timeZone?: string;
}

/** The unused invites, each with its expiry day and Revoke, or one sentence saying there are none. */
export function InvitedSection({ invites, busy, onRevoke, timeZone }: InvitedSectionProps) {
  return (
    <section aria-labelledby="invited-heading" className="flex flex-col gap-4">
      <h2 id="invited-heading" className="flex items-center gap-2 text-lg font-semibold text-ink">
        Invited
        <Badge>{invites.length}</Badge>
      </h2>
      {invites.length === 0 ? (
        <p className="rounded-surface border border-dashed border-border-strong px-5 py-6 text-sm text-ink-muted">
          No invites waiting.
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {invites.map((invite) => (
            <li
              key={invite.id}
              className="flex flex-col gap-3 rounded-surface border border-border bg-surface p-5 shadow-sm sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="flex min-w-0 flex-col gap-0.5">
                <p className="truncate font-mono text-sm text-ink">{invite.email}</p>
                <p className="text-xs text-ink-muted">{`Expires ${formatDay(invite.expiresAt, timeZone)}`}</p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <Button size="sm" variant="secondary" disabled={busy} onClick={() => onRevoke(invite)}>
                  Revoke
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
