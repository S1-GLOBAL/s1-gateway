import { useState } from 'react';
import { Button } from '@/shared/ui/Button';

export interface ResetLinkNoticeProps {
  name: string;
  url: string;
  onDismiss(): void;
}

/** The reset link, in the exact words the admin reads out, with the URL copyable. Shown once. */
export function ResetLinkNotice({ name, url, onDismiss }: ResetLinkNoticeProps) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
    } catch {
      // No clipboard permission: the link stays on screen, selectable.
      setCopied(false);
    }
  }

  return (
    <div
      role="status"
      className="flex flex-col gap-3 rounded-surface border border-border bg-accent-soft p-5 text-sm text-ink shadow-sm"
    >
      <p className="break-words">
        Password reset link for {name}: <span className="font-mono text-xs break-all select-all">{url}</span>. Give it to
        them in person; it works once and expires in 24 hours.
      </p>
      <div className="flex items-center gap-2">
        <Button size="sm" onClick={copy}>
          {copied ? 'Copied' : 'Copy link'}
        </Button>
        <Button size="sm" variant="ghost" onClick={onDismiss}>
          Dismiss
        </Button>
      </div>
    </div>
  );
}