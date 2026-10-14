import type { HTMLAttributes } from 'react';
import { cn } from './cn';

export function Card({ className, ...props }: HTMLAttributes<HTMLElement>) {
  return (
    <section
      className={cn('rounded-surface border border-border bg-surface p-5 shadow-sm', className)}
      {...props}
    />
  );
}
