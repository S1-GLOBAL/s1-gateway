import { Logo } from '@/shared/ui/Logo';
import { ShowcaseSection } from '../ShowcaseSection';

export function BrandSection() {
  return (
    <ShowcaseSection
      index={1}
      title="Brand"
      description="Source One's own logo, drawn in the current ink so it holds on either theme."
    >
      <div className="grid gap-4 sm:grid-cols-[2fr_1fr_1fr]">
        <figure className="flex flex-col gap-3">
          <div className="flex h-36 items-center justify-center rounded-surface border border-border bg-surface px-8 text-ink">
            <Logo variant="wordmark" height={34} />
          </div>
          <figcaption className="text-xs text-ink-muted">Wordmark — the logo file</figcaption>
        </figure>
        <figure className="flex flex-col gap-3">
          <div className="flex h-36 items-center justify-center rounded-surface border border-border bg-surface text-ink">
            <Logo variant="mark" height={40} />
          </div>
          <figcaption className="text-xs text-ink-muted">Mark — beside the name, on the rail, and on phones</figcaption>
        </figure>
        <figure className="flex flex-col gap-3">
          <div className="flex h-36 items-center justify-center rounded-surface border border-border bg-surface">
            <img src="/brand/pwa-192x192.png" alt="" width={72} height={72} className="rounded-surface shadow-md" />
          </div>
          <figcaption className="text-xs text-ink-muted">App icon — the installed PWA</figcaption>
        </figure>
      </div>
    </ShowcaseSection>
  );
}
