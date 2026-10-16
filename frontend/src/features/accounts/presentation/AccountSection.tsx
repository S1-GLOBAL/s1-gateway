import type { ReactNode } from 'react';
import { Badge } from '@/shared/ui/Badge';
import type { Account } from '../domain/account';

export interface AccountSectionProps {
  id: string;
  title: string;
  empty: string;
  accounts: readonly Account[];
  /** The buttons at the right of one row. */
  actions(account: Account): ReactNode;
}

/** One list of accounts under its heading, or one sentence saying there are none. */
export function AccountSection({ id, title, empty, accounts, actions }: AccountSectionProps) {
  const headingId = `${id}-heading`;
  return (
    <section aria-labelledby={headingId} className="flex flex-col gap-4">
      <h2 id={headingId} className="flex items-center gap-2 text-lg font-semibold text-ink">
        {title}
        <Badge>{accounts.length}</Badge>
      </h2>
      {accounts.length === 0 ? (
        <p className="rounded-surface border border-dashed border-border-strong px-5 py-6 text-sm text-ink-muted">
          {empty}
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {accounts.map((account) => (
            <li
              key={account.id}
              className="flex flex-col gap-3 rounded-surface border border-border bg-surface p-5 shadow-sm sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="flex min-w-0 flex-col gap-0.5">
                <p className="flex items-center gap-2 text-md font-medium text-ink">
                  <span className="truncate">{account.fullName}</span>
                  {account.isAdmin && <Badge tone="accent">Admin</Badge>}
                </p>
                <p className="truncate font-mono text-xs text-ink-muted">{account.email}</p>
              </div>
              <div className="flex shrink-0 items-center gap-2">{actions(account)}</div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}