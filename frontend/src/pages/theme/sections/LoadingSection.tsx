import { Suspense, use, useState } from 'react';
import { ErrorState } from '@/shared/ui/ErrorState';
import { SegmentedControl } from '@/shared/ui/SegmentedControl';
import { SkeletonBlock, SkeletonRegion, SkeletonText } from '@/shared/ui/Skeleton';
import { ShowcaseSection } from '../ShowcaseSection';

type Demo = 'loaded' | 'loading' | 'failed';

/** Never settles, so whatever reads it stays suspended until it is unmounted. */
const forever = new Promise<never>(() => undefined);

function Suspends(): null {
  use(forever);
  return null;
}

const SAMPLES = [
  { name: 'Payroll', host: 'payroll.example.com', description: 'Monthly pay runs and payslips.' },
  { name: 'Expenses', host: 'expenses.example.com', description: 'Claims, receipts and approvals.' },
  { name: 'Leave', host: 'hr.example.com', description: 'Book and approve time off.' },
];

function SampleCards() {
  return (
    <div className="grid gap-4 sm:grid-cols-3">
      {SAMPLES.map((sample) => (
        <div key={sample.name} className="flex flex-col gap-4 rounded-surface border border-border bg-surface p-5 shadow-sm">
          <span className="inline-flex size-9 items-center justify-center rounded-control bg-surface-sunken text-md font-semibold text-ink">
            {sample.name.slice(0, 1)}
          </span>
          <div className="flex flex-col gap-1">
            <p className="text-md font-medium text-ink">{sample.name}</p>
            <p className="font-mono text-xs text-ink-subtle">{sample.host}</p>
          </div>
          <p className="text-sm text-ink-muted">{sample.description}</p>
        </div>
      ))}
    </div>
  );
}

function SampleCardsSkeleton() {
  return (
    <SkeletonRegion label="samples" className="grid gap-4 sm:grid-cols-3">
      {SAMPLES.map((sample, order) => (
        <div key={sample.name} className="flex flex-col gap-4 rounded-surface border border-border bg-surface p-5">
          <SkeletonBlock className="size-9" order={order} />
          <div className="flex flex-col gap-1">
            <SkeletonText size="md" className="w-2/3" order={order} />
            <SkeletonText size="xs" className="w-1/2" order={order} />
          </div>
          <SkeletonText size="sm" className="w-full" order={order} />
        </div>
      ))}
    </SkeletonRegion>
  );
}

export function LoadingSection() {
  const [demo, setDemo] = useState<Demo>('loaded');

  return (
    <ShowcaseSection
      index={7}
      title="Loading"
      description="A skeleton shaped like what is coming, invisible for its first 150ms, with one shimmer across every block. A failure keeps the frame and says why."
    >
      <div className="flex flex-col gap-5">
        <SegmentedControl
          label="Sample state"
          value={demo}
          onChange={setDemo}
          options={[
            { value: 'loaded', label: 'Loaded' },
            { value: 'loading', label: 'Loading' },
            { value: 'failed', label: 'Failed' },
          ]}
          className="self-start"
        />
        {demo === 'failed' ? (
          <ErrorState
            title="These tools could not load."
            message="Cannot reach the server. Check your connection and try again."
            onRetry={() => setDemo('loaded')}
          />
        ) : (
          <Suspense fallback={<SampleCardsSkeleton />}>{demo === 'loading' ? <Suspends /> : <SampleCards />}</Suspense>
        )}
      </div>
    </ShowcaseSection>
  );
}
