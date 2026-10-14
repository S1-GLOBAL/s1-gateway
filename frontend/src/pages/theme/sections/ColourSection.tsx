import { useLayoutEffect, useState } from 'react';
import { useTheme } from '@/features/appearance';
import { contrastRatio, meetsAA } from '@/shared/domain/contrast';
import { Badge } from '@/shared/ui/Badge';
import { ShowcaseSection } from '../ShowcaseSection';

interface Swatch {
  token: string;
  use: string;
  /** For a text colour: the token it is read on. Its contrast is shown. */
  on?: string;
}

const GROUPS: { title: string; swatches: Swatch[] }[] = [
  {
    title: 'Surfaces',
    swatches: [
      { token: 'canvas', use: 'Behind everything' },
      { token: 'surface', use: 'Cards, sidebar, panels' },
      { token: 'surface-raised', use: 'Above a surface' },
      { token: 'surface-sunken', use: 'Inputs, wells, skeletons' },
      { token: 'border', use: 'Every hairline' },
      { token: 'border-strong', use: 'Inputs, firm dividers' },
    ],
  },
  {
    title: 'Text',
    swatches: [
      { token: 'ink', use: 'Primary text', on: 'surface' },
      { token: 'ink-muted', use: 'Secondary text', on: 'surface' },
      { token: 'ink-subtle', use: 'Metadata, placeholders', on: 'surface' },
    ],
  },
  {
    title: 'Accent',
    swatches: [
      { token: 'accent', use: 'Fill: primary action, current place' },
      { token: 'accent-hover', use: 'Fill, hovered' },
      { token: 'on-accent', use: 'Text on the fill', on: 'accent' },
      { token: 'accent-ink', use: 'Accent as text or icon', on: 'surface' },
      { token: 'accent-soft', use: 'Tinted backgrounds' },
      { token: 'focus', use: 'Focus rings' },
    ],
  },
  {
    title: 'Status',
    swatches: [
      { token: 'success', use: 'Done, healthy', on: 'surface' },
      { token: 'warning', use: 'Needs attention', on: 'surface' },
      { token: 'danger', use: 'Failed, destructive', on: 'surface' },
      { token: 'info', use: 'Neutral notice', on: 'surface' },
    ],
  },
];

/** Every token's current value, read from the page, refreshed when the theme changes. */
function useTokenValues(): Record<string, string> {
  const { resolved } = useTheme();
  const [values, setValues] = useState<Record<string, string>>({});

  useLayoutEffect(() => {
    const style = getComputedStyle(document.documentElement);
    const next: Record<string, string> = {};
    for (const group of GROUPS) {
      for (const { token } of group.swatches) next[token] = style.getPropertyValue(`--color-${token}`).trim();
    }
    setValues(next);
  }, [resolved]);

  return values;
}

export function ColourSection() {
  const values = useTokenValues();

  return (
    <ShowcaseSection
      index={2}
      title="Colour"
      description="Graphite with a green cast, and one lime. On light, lime is only ever a fill; the olive accent-ink carries it as text. Ratios are live for the current theme."
    >
      <div className="flex flex-col gap-8">
        {GROUPS.map((group) => (
          <div key={group.title} className="flex flex-col gap-3">
            <h3 className="text-sm font-medium text-ink-muted">{group.title}</h3>
            <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {group.swatches.map((swatch) => {
                const value = values[swatch.token] ?? '';
                const ratio = swatch.on ? contrastRatio(value, values[swatch.on] ?? '') : null;
                return (
                  <li key={swatch.token} className="flex items-center gap-3 rounded-surface border border-border bg-surface p-3">
                    <span
                      aria-hidden="true"
                      className="size-11 shrink-0 rounded-control border border-border"
                      style={{ background: `var(--color-${swatch.token})` }}
                    />
                    <div className="flex min-w-0 flex-1 flex-col">
                      <p className="truncate font-mono text-xs text-ink">{swatch.token}</p>
                      <p className="truncate text-xs text-ink-muted">{swatch.use}</p>
                      <p className="truncate font-mono text-2xs text-ink-subtle">{value || '—'}</p>
                    </div>
                    {ratio !== null && (
                      <Badge tone={meetsAA(ratio) ? 'success' : 'danger'} title={`On ${swatch.on}`}>
                        {ratio.toFixed(1)}:1
                      </Badge>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>
    </ShowcaseSection>
  );
}
