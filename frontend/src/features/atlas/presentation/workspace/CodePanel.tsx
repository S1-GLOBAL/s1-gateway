import { Check, Copy } from 'lucide-react';
import { Fragment, useEffect, useState } from 'react';
import { Button } from '@/shared/ui/Button';
import { Card } from '@/shared/ui/Card';
import { cn } from '@/shared/ui/cn';
import type { DecodedSlot, DecodedSpecId } from '../../domain/atlas';
import { summarise } from '../../domain/spec-id-summary';

/** How long Copy reads "Copied". */
export const COPIED_MS = 2000;

const PART: Record<DecodedSlot['state'], string> = {
  value: 'font-medium text-ink',
  'not-known': 'text-ink-muted underline decoration-dashed underline-offset-4',
  'does-not-apply': 'text-ink-subtle',
};

const LEGEND: readonly { state: DecodedSlot['state']; sample: string; label: string }[] = [
  { state: 'value', sample: 'RD', label: 'Known' },
  { state: 'not-known', sample: '00', label: 'Not known yet' },
  { state: 'does-not-apply', sample: 'XX', label: "Doesn't apply" },
];

export interface CodePanelProps {
  /** The code the facts build now. Undefined until the first one arrives, or while the facts are refused. */
  decoded: DecodedSpecId | undefined;
  /** Why the code could not be built, when the reason is not beside a control. */
  error?: string;
}

/** The code as it forms: each part styled by what is known, a legend, Copy, and the facts in plain words. */
export function CodePanel({ decoded, error }: CodePanelProps) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), COPIED_MS);
    return () => clearTimeout(timer);
  }, [copied]);

  async function copy() {
    if (!decoded) return;
    try {
      await navigator.clipboard.writeText(decoded.code);
      setCopied(true);
    } catch {
      // No clipboard (an insecure page, or permission refused): the code stays selectable.
    }
  }

  return (
    <Card aria-label="Spec ID" className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-sm font-medium text-ink-muted">Spec ID</h2>
        <Button variant="secondary" size="sm" onClick={copy} disabled={!decoded}>
          {copied ? (
            <Check size={16} strokeWidth={1.75} aria-hidden="true" />
          ) : (
            <Copy size={16} strokeWidth={1.75} aria-hidden="true" />
          )}
          {copied ? 'Copied' : 'Copy'}
        </Button>
      </div>

      <p className="min-h-6 font-mono text-md break-all">
        {decoded?.slots.map((slot, index) => (
          <Fragment key={slot.key}>
            {index > 0 && <span className="text-ink-subtle">.</span>}
            <span className={PART[slot.state]}>{slot.raw}</span>
          </Fragment>
        ))}
      </p>

      <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink-muted">
        {LEGEND.map(({ state, sample, label }) => (
          <li key={state} className="inline-flex items-center gap-1.5">
            <span aria-hidden="true" className={cn('font-mono', PART[state])}>
              {sample}
            </span>
            {label}
          </li>
        ))}
      </ul>

      {decoded && <p className="border-t border-border pt-4 text-sm text-ink">{summarise(decoded)}</p>}
      {error && (
        <p role="alert" className="rounded-control bg-danger-soft px-3 py-2 text-sm text-danger">
          {error}
        </p>
      )}
    </Card>
  );
}
