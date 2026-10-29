import { Suspense, useEffect, useState } from 'react';
import { cn } from '@/shared/ui/cn';
import { EmptyState } from '@/shared/ui/EmptyState';
import { BookCheckIcon } from '@/shared/ui/icons';
import { SegmentedControl } from '@/shared/ui/SegmentedControl';
import { SkeletonRegion } from '@/shared/ui/Skeleton';
import { useDictionary } from '../../application/use-dictionary';
import { useSuggestionDetails, useSuggestionList } from '../../application/use-suggestions';
import type { AtlasDictionary } from '../../domain/atlas';
import { SuggestionCard, type Viewer } from './SuggestionCard';
import { SuggestionListSkeleton } from './SuggestionListSkeleton';

type Tab = 'waiting' | 'history';

interface ListProps {
  dictionary: AtlasDictionary;
  viewer: Viewer;
  timeZone?: string;
  onNotice(message: string): void;
}

export interface DictionaryChangesProps {
  viewer: Viewer;
  timeZone?: string;
  /** A dictionary change a link asked for: the history opens on it, with its trail. */
  change?: number | null;
}

/**
 * Every suggested change to the dictionary (#95): those waiting for an admin,
 * oldest first, each in full; and the history, latest decision first. What an
 * action did is announced above the list.
 */
export function DictionaryChanges({ viewer, timeZone, change = null }: DictionaryChangesProps) {
  const { data: dictionary } = useDictionary();
  const [tab, setTab] = useState<Tab>(change === null ? 'waiting' : 'history');
  const [notice, setNotice] = useState<string | null>(null);
  const list: ListProps = { dictionary, viewer, timeZone, onNotice: setNotice };

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
      <p
        role="status"
        className={cn(notice ? 'rounded-control bg-success-soft px-3 py-2 text-sm text-success' : 'sr-only')}
      >
        {notice}
      </p>
      <Suspense
        fallback={
          <SkeletonRegion label="suggestions">
            <SuggestionListSkeleton />
          </SkeletonRegion>
        }
      >
        {tab === 'waiting' ? <Waiting {...list} /> : <History {...list} change={change} />}
      </Suspense>
    </div>
  );
}

function Waiting(props: ListProps) {
  const { data: waiting } = useSuggestionList('waiting');
  const details = useSuggestionDetails(waiting.map((suggestion) => suggestion.id));
  if (waiting.length === 0) {
    return (
      <EmptyState
        icon={<BookCheckIcon size={20} />}
        title="No suggestions waiting."
        description="A suggested change to the dictionary waits here until an admin approves or rejects it."
      />
    );
  }
  return (
    <ul className="flex flex-col gap-4">
      {waiting.map((suggestion, index) => {
        const detail = details[index] ?? null;
        return (
          <li key={suggestion.id}>
            <SuggestionCard suggestion={detail ?? suggestion} detail={detail} {...props} />
          </li>
        );
      })}
    </ul>
  );
}

function History({ change, ...props }: ListProps & { change: number | null }) {
  const { data: decided } = useSuggestionList('decided');

  useEffect(() => {
    if (change !== null) document.getElementById(changeId(change))?.scrollIntoView?.({ block: 'start' });
  }, [change]);

  if (decided.length === 0) {
    return <EmptyState icon={<BookCheckIcon size={20} />} title="No dictionary changes yet." description="Approved changes appear here." />;
  }
  return (
    <ul className="flex flex-col gap-4">
      {decided.map((suggestion) => {
        const asked = change !== null && suggestion.changeNumber === change;
        return (
          <li key={suggestion.id} id={suggestion.changeNumber === null ? undefined : changeId(suggestion.changeNumber)}>
            <SuggestionCard suggestion={suggestion} detail={null} opened={asked} {...props} />
          </li>
        );
      })}
    </ul>
  );
}

function changeId(number: number): string {
  return `dictionary-change-${number}`;
}
