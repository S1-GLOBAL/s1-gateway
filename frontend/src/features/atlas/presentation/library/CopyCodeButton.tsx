import { Check, Copy } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Button } from '@/shared/ui/Button';
import { cn } from '@/shared/ui/cn';

/** How long the icon reads "Copied". Same wait as the Spec ID workspace. */
export const COPIED_MS = 2000;

/** Copies one Spec ID code. Sits beside the code, so it must stay out of the card's link. */
export function CopyCodeButton({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), COPIED_MS);
    return () => clearTimeout(timer);
  }, [copied]);

  async function copy() {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
    } catch {
      // No clipboard (an insecure page, or permission refused): the code stays selectable.
    }
  }

  return (
    <Button
      variant="ghost"
      size="sm"
      aria-label={copied ? 'Copied' : 'Copy code'}
      title={copied ? 'Copied' : 'Copy code'}
      onClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
        void copy();
      }}
      className={cn('pointer-events-auto relative z-10 size-8 px-0', copied && 'text-accent-ink')}
    >
      {copied ? (
        <Check size={16} strokeWidth={1.75} aria-hidden="true" />
      ) : (
        <Copy size={16} strokeWidth={1.75} aria-hidden="true" />
      )}
    </Button>
  );
}
