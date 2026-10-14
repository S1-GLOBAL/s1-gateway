import type { ReactNode } from 'react';

/** One numbered part of the showcase: a heading, a sentence, and the samples. */
export function ShowcaseSection({
  index,
  title,
  description,
  children,
}: {
  index: number;
  title: string;
  description: string;
  children: ReactNode;
}) {
  const id = `theme-${title.toLowerCase().replace(/\s+/g, '-')}`;
  return (
    <section aria-labelledby={id} className="grid gap-6 border-t border-border pt-10 lg:grid-cols-[220px_1fr] lg:gap-10">
      <div className="flex flex-col gap-1">
        <p className="font-mono text-xs text-ink-subtle">{String(index).padStart(2, '0')}</p>
        <h2 id={id} className="text-lg font-semibold text-ink">
          {title}
        </h2>
        <p className="text-sm text-ink-muted">{description}</p>
      </div>
      <div className="min-w-0">{children}</div>
    </section>
  );
}
