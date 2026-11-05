import { CircleCheck } from 'lucide-react';
import * as m from 'motion/react-m';
import { Link } from 'react-router-dom';
import { cn } from '@/shared/ui/cn';
import { ArrowRightIcon } from '@/shared/ui/icons';
import { useIconTrigger } from '@/shared/ui/motion';
import type { SavedSpecId } from '../../domain/atlas';
import { SpecIdCard } from './SpecIdCard';

const MotionLink = m.create(Link);

/** A link that looks like the secondary button. */
const SECONDARY_LINK =
  'inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-control border border-border-strong bg-surface px-4 text-sm font-medium whitespace-nowrap text-ink shadow-sm transition-colors duration-150 ease-standard hover:bg-surface-raised';

export interface MatchCardProps {
  saved: SavedSpecId;
  /** A perfect match has exactly the code asked for; a match has every fact asked for and records more. */
  exact: boolean;
  /** The code a new Spec ID would start from. */
  code: string;
  timeZone?: string;
}

/**
 * The saved Spec ID Search found, whether from words or a pasted code: nothing
 * to confirm. Starting another opens New Spec ID with the code, where, for a
 * perfect match, Save waits until one of its facts changes, so it is never
 * saved twice.
 */
export function MatchCard({ saved, exact, code, timeZone }: MatchCardProps) {
  // The arrow plays on hover only.
  const { trigger } = useIconTrigger();
  return (
    <section
      aria-label={exact ? 'Perfect match' : 'Match'}
      className="flex flex-col gap-4 rounded-surface border border-accent bg-accent-soft p-5 shadow-sm"
    >
      <div className="flex flex-col gap-1">
        <p role="status" className="inline-flex items-center gap-2 text-md font-medium text-accent-ink">
          <CircleCheck size={20} strokeWidth={1.75} aria-hidden="true" />
          {exact ? 'We found a perfect match!' : 'We found a match!'}
        </p>
        {!exact && <p className="text-sm text-ink-muted">It has every fact you typed, and records more.</p>}
      </div>
      <SpecIdCard saved={saved} timeZone={timeZone} />
      <MotionLink
        to={`/atlas/new?code=${encodeURIComponent(code)}`}
        initial={trigger.initial}
        animate={trigger.animate}
        onHoverStart={trigger.onHoverStart}
        // A long label wraps inside the box at phone width rather than running past it.
        className={cn(SECONDARY_LINK, 'h-auto min-h-10 max-w-full self-start py-2 text-left whitespace-normal')}
      >
        This is not what I'm looking for, create a Spec ID
        <ArrowRightIcon size={16} />
      </MotionLink>
    </section>
  );
}
