import { useState } from 'react';
import { Button } from '@/shared/ui/Button';

export interface LinkNoticeProps {
  /** What the link is and for whom, before the colon: `Invite link for ada@sourceone.global`. */
  lead: string;
  url: string;
  /** The sentence after the link: how to send it, and how long it works. */
  instructions: string;
  onDismiss(): void;
}

/** A one-time link, in the exact words the admin passes on, with the URL copyable. Shown once. */
export function LinkNotice({ lead, url, instructions, onDismiss }: LinkNoticeProps) {
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
        {lead}: <span className="font-mono text-xs break-all select-all">{url}</span>. {instructions}
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
