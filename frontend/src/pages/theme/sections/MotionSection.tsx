import * as m from 'motion/react-m';
import { useState } from 'react';
import { duration, ease } from '@/shared/ui/motion';
import { ShowcaseSection } from '../ShowcaseSection';

const TOKENS = [
  { name: 'duration-fast', value: '120ms', use: 'Hover, press, leaving', seconds: duration.fast, curve: ease.standard },
  { name: 'duration-base', value: '200ms', use: 'Toggles, small arrivals', seconds: duration.base, curve: ease.standard },
  { name: 'duration-slow', value: '320ms', use: 'Pages, panels', seconds: duration.slow, curve: ease.standard },
  { name: 'duration-curtain', value: '600ms', use: 'The door curtain', seconds: duration.curtain, curve: ease.emphasized },
  { name: 'ease-standard', value: '0.2, 0, 0, 1', use: 'Most movement', seconds: 0.6, curve: ease.standard },
  { name: 'ease-emphasized', value: '0.05, 0.7, 0.1, 1', use: 'Arrivals, the nav pill', seconds: 0.6, curve: ease.emphasized },
  { name: 'ease-exit', value: '0.3, 0, 1, 1', use: 'Leaving', seconds: 0.6, curve: ease.exit },
];

function Track({ seconds, curve }: { seconds: number; curve: readonly [number, number, number, number] }) {
  const [end, setEnd] = useState(false);
  return (
    <button
      type="button"
      onClick={() => setEnd((current) => !current)}
      aria-label="Play"
      className="relative h-8 w-full rounded-full bg-surface-sunken"
    >
      <m.span
        aria-hidden="true"
        className="absolute top-1 left-1 size-6 rounded-full bg-accent shadow-sm"
        animate={{ left: end ? 'calc(100% - 1.75rem)' : '0.25rem' }}
        transition={{ duration: seconds, ease: curve }}
      />
    </button>
  );
}

export function MotionSection() {
  return (
    <ShowcaseSection
      index={8}
      title="Motion"
      description="Short inside the hub. The door curtain is the long one. Press a track to play its token."
    >
      <ul className="flex flex-col divide-y divide-border rounded-surface border border-border bg-surface">
        {TOKENS.map((token) => (
          <li key={token.name} className="grid items-center gap-3 px-5 py-4 sm:grid-cols-[180px_1fr_200px]">
            <div className="flex flex-col">
              <span className="font-mono text-xs text-ink">{token.name}</span>
              <span className="font-mono text-2xs text-ink-subtle">{token.value}</span>
            </div>
            <Track seconds={token.seconds} curve={token.curve} />
            <span className="text-xs text-ink-muted sm:text-right">{token.use}</span>
          </li>
        ))}
      </ul>
    </ShowcaseSection>
  );
}
