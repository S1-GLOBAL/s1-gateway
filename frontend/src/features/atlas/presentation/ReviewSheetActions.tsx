import * as m from 'motion/react-m';
import { Button } from '@/shared/ui/Button';
import { cn } from '@/shared/ui/cn';
import { DownloadIcon, ExternalLinkIcon } from '@/shared/ui/icons';
import { useIconTrigger } from '@/shared/ui/motion';
import { useReviewSheet } from '../application/use-review-sheet';
import { useReviewSheetLink, useSyncReviewSheet } from '../application/use-review-sheet-link';
import { describeSheetSync, type ReviewSheetSync } from '../domain/review-sheet';

/** The browser saves a file it is handed as a link to follow, as it does any download. */
function save(file: Blob, fileName: string): void {
  const url = URL.createObjectURL(file);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

/** The file's name, dated by the reader's own calendar: the server's day is UTC, a day behind in Manila's morning. */
function localFileName(now: Date): string {
  const day = [now.getFullYear(), now.getMonth() + 1, now.getDate()].map((part) => String(part).padStart(2, '0')).join('-');
  return `atlas-spec-ids-${day}.xlsx`;
}

/** At phone width each action is its icon alone, beside the tabs; its name stays for assistive technology. */
const PHONE = 'max-sm:w-10 max-sm:px-0';

/** The shared review sheet, opened in a new tab: a link that looks like the secondary button. Its icon plays on hover and focus. */
function ReviewSheetLink({ url }: { url: string }) {
  const { trigger } = useIconTrigger();
  return (
    <m.a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      {...trigger}
      className={cn(
        'inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-control border border-border-strong bg-surface px-4 text-sm font-medium whitespace-nowrap text-ink shadow-sm transition-colors duration-150 ease-standard hover:bg-surface-raised',
        PHONE,
      )}
    >
      <ExternalLinkIcon size={16} />
      <span className="max-sm:sr-only">Review sheet</span>
      <span className="sr-only"> (opens in a new tab)</span>
    </m.a>
  );
}

/**
 * When the shared sheet last synced with Atlas, under the buttons, and an
 * admin's Sync now (plan 0016). Left out at phone width, where the actions
 * are icons alone: the sync runs all the same.
 */
function SheetSyncStatus({ sync, canSync }: { sync: ReviewSheetSync; canSync: boolean }) {
  const syncNow = useSyncReviewSheet();
  const { text, failed } = describeSheetSync(sync, new Date(), { forAdmin: canSync });
  return (
    <div className="mt-1 flex max-w-xs flex-col items-end gap-1 max-sm:hidden">
      <div className="flex items-center justify-end gap-2">
        <p className={cn('text-right text-xs', failed ? 'text-danger' : 'text-ink-subtle')}>{text}</p>
        {canSync && (
          <Button
            variant="ghost"
            size="sm"
            loading={syncNow.isPending || sync.state === 'syncing'}
            onClick={() => syncNow.mutate()}
            aria-describedby={syncNow.isError ? 'sheet-sync-error' : undefined}
          >
            Sync now
          </Button>
        )}
      </div>
      {syncNow.isError && (
        <p id="sheet-sync-error" role="alert" className="text-right text-xs text-danger">
          The sheet could not be synced. Try again.
        </p>
      )}
    </div>
  );
}

/**
 * The review's two places (plan 0016): **Review sheet** opens the shared
 * Google Sheet everyone reviews the codes in, once the host has set one; and
 * **Spec IDs** downloads the Spec IDs sheet of the library as it stands. Any
 * signed-in staff may. A failed download is said beside the buttons. When
 * Atlas keeps the sheet in step, when it last synced is said under them, and
 * an admin, `canSync`, may sync it now.
 */
export function ReviewSheetActions({ className, canSync = false }: { className?: string; canSync?: boolean }) {
  const link = useReviewSheetLink();
  const sheet = useReviewSheet();
  const url = link.data?.url ?? null;
  const sync = link.data?.sync ?? null;

  function download() {
    sheet.mutate(undefined, { onSuccess: ({ file }) => save(file, localFileName(new Date())) });
  }

  return (
    <div className={cn('flex flex-col items-end', className)}>
      <div className="flex items-start gap-2">
        {url !== null && <ReviewSheetLink url={url} />}
        <Button
          variant="secondary"
          loading={sheet.isPending}
          onClick={download}
          aria-describedby={sheet.isError ? 'review-sheet-error' : undefined}
          className={PHONE}
        >
          <DownloadIcon size={16} />
          <span className="sr-only">Download </span>
          <span className="max-sm:sr-only">Spec IDs</span>
        </Button>
      </div>
      {sheet.isError && (
        <p id="review-sheet-error" role="alert" className="mt-1 text-sm text-danger">
          The Spec IDs sheet could not be made. Try again.
        </p>
      )}
      {sync !== null && <SheetSyncStatus sync={sync} canSync={canSync} />}
    </div>
  );
}
