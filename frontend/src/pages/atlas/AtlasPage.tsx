import { useRef, useState, type KeyboardEvent } from 'react';
import { useSearchParams } from 'react-router-dom';
import { AtlasLibrary, DictionarySheet, useDictionary } from '@/features/atlas';
import { Button } from '@/shared/ui/Button';
import { cn } from '@/shared/ui/cn';
import { BookOpenIcon } from '@/shared/ui/icons';
import { readLastSearch, rememberSearch } from './last-search';

const ATLAS_TABS = [
  { id: 'search', label: 'Search' },
  { id: 'browse', label: 'Browse' },
  { id: 'analyze', label: 'Analyze' },
] as const;

type AtlasTab = (typeof ATLAS_TABS)[number]['id'];

/**
 * `/atlas`. Search asks; Browse and Analyze are the other two places, still
 * empty. What Search asks is kept in the address, `?q=`, so going back to the
 * page, or reloading it, asks it again; and for the tab, so opening Atlas
 * without one, from a Spec ID or New Spec ID, asks the last one again.
 */
export function AtlasPage() {
  const [tab, setTab] = useState<AtlasTab>('search');
  const [params, setParams] = useSearchParams();
  const [dictionaryOpen, setDictionaryOpen] = useState(false);
  const { data: dictionary } = useDictionary();

  return (
    <div className="flex flex-col gap-10">
      <h1 className="sr-only">Atlas</h1>
      <div className="flex items-end justify-between gap-4 border-b border-border">
        <AtlasTabs tab={tab} onChange={setTab} />
        <Button variant="secondary" onClick={() => setDictionaryOpen(true)} className="mb-2">
          <BookOpenIcon size={16} />
          Dictionary
        </Button>
      </div>

      {/* Stays mounted, so a question survives a trip to the other tabs. */}
      <div role="tabpanel" id="atlas-panel-search" aria-labelledby="atlas-tab-search" hidden={tab !== 'search'}>
        <AtlasLibrary
          dictionary={dictionary}
          untilAsked
          initialText={params.get('q') ?? readLastSearch()}
          onAsk={(text) => {
            // Replaced, not pushed: Back leaves Atlas rather than stepping through every pause in typing.
            setParams(text === '' ? {} : { q: text }, { replace: true });
            rememberSearch(text);
          }}
        />
      </div>
      {tab !== 'search' && <div role="tabpanel" id={`atlas-panel-${tab}`} aria-labelledby={`atlas-tab-${tab}`} />}
      <DictionarySheet dictionary={dictionary} open={dictionaryOpen} onClose={() => setDictionaryOpen(false)} />
    </div>
  );
}

function AtlasTabs({ tab, onChange }: { tab: AtlasTab; onChange: (tab: AtlasTab) => void }) {
  const buttons = useRef<(HTMLButtonElement | null)[]>([]);

  function onKeyDown(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    const last = ATLAS_TABS.length - 1;
    const nextIndex =
      event.key === 'ArrowRight' || event.key === 'ArrowDown'
        ? (index + 1) % ATLAS_TABS.length
        : event.key === 'ArrowLeft' || event.key === 'ArrowUp'
          ? (index - 1 + ATLAS_TABS.length) % ATLAS_TABS.length
          : event.key === 'Home'
            ? 0
            : event.key === 'End'
              ? last
              : -1;
    if (nextIndex === -1) return;
    event.preventDefault();
    const next = ATLAS_TABS[nextIndex];
    if (!next) return;
    onChange(next.id);
    buttons.current[nextIndex]?.focus();
  }

  return (
    <div role="tablist" aria-label="Atlas" className="flex gap-1">
      {ATLAS_TABS.map((option, index) => {
        const selected = option.id === tab;
        return (
          <button
            key={option.id}
            ref={(element) => {
              buttons.current[index] = element;
            }}
            type="button"
            role="tab"
            id={`atlas-tab-${option.id}`}
            aria-selected={selected}
            aria-controls={`atlas-panel-${option.id}`}
            tabIndex={selected ? 0 : -1}
            onClick={() => onChange(option.id)}
            onKeyDown={(event) => onKeyDown(event, index)}
            className={cn(
              'relative -mb-px px-3 pb-3 text-sm font-medium transition-colors duration-150 ease-standard first:pl-0',
              selected ? 'text-ink' : 'text-ink-muted hover:text-ink',
            )}
          >
            {selected && <span aria-hidden="true" className="absolute inset-x-0 bottom-0 h-0.5 rounded-full bg-accent" />}
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
