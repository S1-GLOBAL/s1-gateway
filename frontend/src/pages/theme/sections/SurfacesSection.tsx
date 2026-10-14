import { cn } from '@/shared/ui/cn';
import { ShowcaseSection } from '../ShowcaseSection';

const LEVELS = [
  { name: 'shadow-sm', className: 'shadow-sm', use: 'Resting cards, inputs, buttons' },
  { name: 'shadow-md', className: 'shadow-md', use: 'Hovered cards, tooltips' },
  { name: 'shadow-lg', className: 'shadow-lg', use: 'Sheets, the update prompt' },
];

export function SurfacesSection() {
  return (
    <ShowcaseSection
      index={5}
      title="Surfaces"
      description="Two radii: 14px for surfaces, 8px for controls. On dark, depth is a hairline and a 1px top highlight — shadows vanish on black."
    >
      <div className="flex flex-col gap-4">
        <div className="grid gap-4 sm:grid-cols-3">
          {LEVELS.map((level) => (
            <div key={level.name} className={cn('flex h-32 flex-col justify-end gap-0.5 rounded-surface border border-border bg-surface p-4', level.className)}>
              <p className="font-mono text-xs text-ink">{level.name}</p>
              <p className="text-xs text-ink-muted">{level.use}</p>
            </div>
          ))}
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="flex h-24 flex-col justify-end rounded-surface bg-surface-sunken p-4">
            <p className="font-mono text-xs text-ink">surface-sunken</p>
            <p className="text-xs text-ink-muted">A well: inputs and skeletons sit on it</p>
          </div>
          <div className="flex h-24 flex-col justify-end rounded-surface border border-border bg-surface-raised p-4">
            <p className="font-mono text-xs text-ink">surface-raised</p>
            <p className="text-xs text-ink-muted">Above a surface: hovered rows, menus</p>
          </div>
        </div>
      </div>
    </ShowcaseSection>
  );
}
