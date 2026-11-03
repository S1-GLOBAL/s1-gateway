import { Button } from '@/shared/ui/Button';
import { DownloadIcon } from '@/shared/ui/icons';
import { useReviewSheet } from '../application/use-review-sheet';

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
  return `atlas-review-${day}.xlsx`;
}

/**
 * Downloads the review workbook (plan 0014): every imported row beside what
 * Atlas read from it, for the people who check the codes. Any signed-in staff
 * may. Busy while it is made; a failure is said beside the button.
 */
export function ReviewSheetButton({ className }: { className?: string }) {
  const sheet = useReviewSheet();

  function download() {
    sheet.mutate(undefined, { onSuccess: ({ file }) => save(file, localFileName(new Date())) });
  }

  return (
    <div className={className}>
      {/* At phone width it is its icon alone, beside the tabs; its name stays for assistive technology. */}
      <Button
        variant="secondary"
        loading={sheet.isPending}
        onClick={download}
        aria-describedby={sheet.isError ? 'review-sheet-error' : undefined}
        className="max-sm:w-10 max-sm:px-0"
      >
        <DownloadIcon size={16} />
        <span className="max-sm:sr-only">Review sheet</span>
      </Button>
      {sheet.isError && (
        <p id="review-sheet-error" role="alert" className="mt-1 text-sm text-danger">
          The review sheet could not be made. Try again.
        </p>
      )}
    </div>
  );
}
