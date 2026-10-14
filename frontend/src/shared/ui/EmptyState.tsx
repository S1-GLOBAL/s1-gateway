import * as m from 'motion/react-m';
import type { ReactNode } from 'react';
import { iconTrigger } from './motion';

export interface EmptyStateProps {
  icon: ReactNode;
  title: string;
  description: string;
  action?: ReactNode;
}

/** Nothing here yet: one sentence about what goes here, and how to add it. */
export function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  return (
    <m.div
      {...iconTrigger}
      className="flex flex-col items-center gap-4 rounded-surface border border-dashed border-border-strong px-6 py-16 text-center"
    >
      <span className="inline-flex size-12 items-center justify-center rounded-full bg-accent-soft text-accent-ink">{icon}</span>
      <div className="flex max-w-sm flex-col gap-1">
        <p className="text-md font-medium text-ink">{title}</p>
        <p className="text-sm text-ink-muted">{description}</p>
      </div>
      {action}
    </m.div>
  );
}
