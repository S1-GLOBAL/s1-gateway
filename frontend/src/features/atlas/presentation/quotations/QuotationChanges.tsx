import { Suspense, useState } from 'react';
import { cn } from '@/shared/ui/cn';
import { EmptyState } from '@/shared/ui/EmptyState';
import { QuotedIcon } from '@/shared/ui/icons';
import { SegmentedControl } from '@/shared/ui/SegmentedControl';
import { SkeletonRegion } from '@/shared/ui/Skeleton';
import { useQuotationList } from '../../application/use-quotations';
import { SuggestionListSkeleton } from '../dictionary/SuggestionListSkeleton';
import { QuotationCard, type Viewer } from './QuotationCard';

type Tab = 'waiting' | 'history';

interface ListProps {
  viewer: Viewer;
  timeZone?: string;
  onNotice(message: string): void;
}

/**
 * Every quotation added in Atlas (plan 0017): those waiting for an admin,
 * oldest first, and the history, latest decision first. Each names the Spec
 * ID it quotes. What an action did is announced above the list.
 */
export function QuotationChanges({ viewer, timeZone }: { viewer: Viewer; timeZone?: string }) {
  const [tab, setTab] = useState<Tab>('waiting');
  const [notice, setNotice] = useState<string | null>(null);
  const list: ListProps = { viewer, timeZone, onNotice: setNotice };

  return (
    <div className="flex flex-col gap-6">
      <SegmentedControl
        label="Show"
        value={tab}
        options={[
          { value: 'waiting', label: 'Waiting' },
          { value: 'history', label: 'History' },
        ]}
        onChange={(next) => {
          setTab(next);
          setNotice(null);
        }}
        className="self-start"
      />
      <p role="status" className={cn(notice ? 'rounded-control bg-success-soft px-3 py-2 text-sm text-success' : 'sr-only')}>
        {notice}
      </p>
      <Suspense
        fallback={
          <SkeletonRegion label="quotations">
            <SuggestionListSkeleton />
          </SkeletonRegion>
        }
      >
        <QuotationList state={tab === 'waiting' ? 'waiting' : 'decided'} {...list} />
      </Suspense>
    </div>
  );
}

function QuotationList({ state, ...props }: ListProps & { state: 'waiting' | 'decided' }) {
  const { data: quotations } = useQuotationList(state);
  if (quotations.length === 0) {
    return state === 'waiting' ? (
      <EmptyState
        icon={<QuotedIcon size={20} />}
        title="No quotations waiting."
        description="A quotation added to a Spec ID waits here until an admin approves or rejects it."
      />
    ) : (
      <EmptyState icon={<QuotedIcon size={20} />} title="No quotations decided yet." description="Approved and rejected quotations appear here." />
    );
  }
  return (
    <ul className="flex flex-col gap-4">
      {quotations.map((quotation) => (
        <li key={quotation.id}>
          <QuotationCard quotation={quotation} showSpecId {...props} />
        </li>
      ))}
    </ul>
  );
}
