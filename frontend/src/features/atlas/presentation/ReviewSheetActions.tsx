import * as m from 'motion/react-m';
import { Button } from '@/shared/ui/Button';
import { cn } from '@/shared/ui/cn';
import { DownloadIcon, ExternalLinkIcon } from '@/shared/ui/icons';
import { useIconTrigger } from '@/shared/ui/motion';
import { useReviewSheet } from '../application/use-review-sheet';
import { useReviewSheetLink } from '../application/use-review-sheet-link';

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
 * The review's two places (plan 0016): **Review sheet** opens the shared
 * Google Sheet everyone reviews the codes in, once the host has set one; and
 * **Spec IDs** downloads the Spec IDs sheet of the library as it stands. Any
 * signed-in staff may. A failed download is said beside the buttons.
 */
export function ReviewSheetActions({ className }: { className?: string }) {
  const link = useReviewSheetLink();
  const sheet = useReviewSheet();

  function download() {
    sheet.mutate(undefined, { onSuccess: ({ file }) => save(file, localFileName(new Date())) });
  }

  return (
    <div className={className}>
      <div className="flex items-start gap-2">
        {link.data && <ReviewSheetLink url={link.data} />}
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
    </div>
  );
}
