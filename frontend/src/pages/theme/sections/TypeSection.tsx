import { cn } from '@/shared/ui/cn';
import { ShowcaseSection } from '../ShowcaseSection';

const SCALE = [
  { token: 'text-3xl', spec: '40 / 48 · 600', className: 'text-3xl font-semibold', sample: 'Supplying the future' },
  { token: 'text-2xl', spec: '32 / 40 · 600', className: 'text-2xl font-semibold', sample: 'Everything staff open, in one place' },
  { token: 'text-xl', spec: '24 / 32 · 600', className: 'text-xl font-semibold', sample: 'Tools' },
  { token: 'text-lg', spec: '20 / 28 · 600', className: 'text-lg font-semibold', sample: 'Finance' },
  { token: 'text-md', spec: '16 / 24 · 500', className: 'text-md font-medium', sample: 'Payroll' },
  { token: 'text-base', spec: '14 / 22 · 400', className: 'text-base', sample: 'Monthly pay runs close on the 25th; anything later moves to the next cycle.' },
  { token: 'text-sm', spec: '13 / 20 · 400', className: 'text-sm', sample: 'Tools with the same category are shown together.' },
  { token: 'text-xs', spec: '12 / 16 · 400', className: 'text-xs text-ink-muted', sample: 'Added 14 October 2026' },
  { token: 'text-2xs', spec: '11 / 16 · 500', className: 'text-2xs font-medium uppercase text-ink-muted', sample: 'Finance · 3 tools' },
];

export function TypeSection() {
  return (
    <ShowcaseSection
      index={3}
      title="Type"
      description="Poppins for everything people read; Geist Mono for addresses, IDs and numbers that must line up."
    >
      <div className="flex flex-col divide-y divide-border rounded-surface border border-border bg-surface">
        {SCALE.map((row) => (
          <div key={row.token} className="grid items-baseline gap-2 px-5 py-4 sm:grid-cols-[140px_1fr]">
            <div className="flex flex-col">
              <span className="font-mono text-xs text-ink">{row.token}</span>
              <span className="font-mono text-2xs text-ink-subtle">{row.spec}</span>
            </div>
            <p className={cn('min-w-0 text-ink', row.className)}>{row.sample}</p>
          </div>
        ))}
        <div className="grid items-baseline gap-2 px-5 py-4 sm:grid-cols-[140px_1fr]">
          <div className="flex flex-col">
            <span className="font-mono text-xs text-ink">font-mono</span>
            <span className="font-mono text-2xs text-ink-subtle">Geist Mono</span>
          </div>
          <p className="font-mono text-sm text-ink">payroll.example.com · 0123456789 · ⌘K</p>
        </div>
      </div>
    </ShowcaseSection>
  );
}
