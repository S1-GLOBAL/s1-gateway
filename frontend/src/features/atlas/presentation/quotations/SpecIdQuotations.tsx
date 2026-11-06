import { useState } from 'react';
import { Badge } from '@/shared/ui/Badge';
import { Button } from '@/shared/ui/Button';
import { cn } from '@/shared/ui/cn';
import { ErrorState } from '@/shared/ui/ErrorState';
import { PlusIcon } from '@/shared/ui/icons';
import { useSpecIdQuotations } from '../../application/use-quotations';
import { QuotationCard, type Viewer } from './QuotationCard';
import { QuotationForm } from './QuotationForm';

/** Add quotation, on a Spec ID's manufacturers screen: opens the form (plan 0017). */
export function AddQuotationButton({ onAdd }: { onAdd(): void }) {
  return (
    <Button onClick={onAdd}>
      <PlusIcon size={16} />
      Add quotation
    </Button>
  );
}

export interface SpecIdQuotationsProps {
  specId: string;
  viewer: Viewer;
  /** Whether the form to add one is open: the button that opens it sits in the page's header. */
  adding: boolean;
  onAddingChange(adding: boolean): void;
  timeZone?: string;
}

/**
 * A Spec ID's quotations waiting for an admin, on its manufacturers screen
 * (plan 0017), with the form that adds one. Admins approve or reject them
 * here; whoever added one edits or withdraws it. Nothing shows while none waits.
 */
export function SpecIdQuotations({ specId, viewer, adding, onAddingChange, timeZone }: SpecIdQuotationsProps) {
  const waiting = useSpecIdQuotations(specId);
  const [notice, setNotice] = useState<string | null>(null);
  const quotations = waiting.data ?? [];

  return (
    <>
      <p role="status" className={cn(notice ? 'rounded-control bg-success-soft px-3 py-2 text-sm text-success' : 'sr-only')}>
        {notice}
      </p>
      {waiting.isError && <ErrorState message={waiting.error.message} onRetry={() => void waiting.refetch()} />}
      {quotations.length > 0 && (
        <section aria-label="Waiting for approval" className="flex flex-col gap-3">
          <div className="flex flex-col gap-0.5">
            <h2 className="flex items-center gap-2 text-lg font-semibold text-ink">
              Waiting for approval
              <Badge tone="warning">{quotations.length}</Badge>
            </h2>
            <p className="text-sm text-ink-muted">Quotations added here join this Spec ID's quotes once an admin approves them.</p>
          </div>
          <ul className="flex flex-col gap-3">
            {quotations.map((quotation) => (
              <li key={quotation.id}>
                <QuotationCard quotation={quotation} viewer={viewer} timeZone={timeZone} onNotice={setNotice} />
              </li>
            ))}
          </ul>
        </section>
      )}
      <QuotationForm
        // A fresh form each time it opens.
        key={String(adding)}
        specId={specId}
        open={adding}
        editing={null}
        onClose={() => onAddingChange(false)}
        onSent={(message) => {
          onAddingChange(false);
          setNotice(message);
        }}
      />
    </>
  );
}
