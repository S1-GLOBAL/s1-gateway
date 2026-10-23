import { Badge } from '@/shared/ui/Badge';
import { Button } from '@/shared/ui/Button';
import { useSetManufacturerStage } from '../../application/use-set-manufacturer-stage';
import type { AdminStage, ManufacturerQuote, ManufacturerStage, SpecIdManufacturer } from '../../domain/atlas';
import { formatSavedDate } from '../../domain/format-saved-date';
import { manufacturerGroups, shownLeadTime, shownValue, stageName } from '../../domain/manufacturer-groups';

export interface ManufacturerGroupsProps {
  specId: string;
  manufacturers: SpecIdManufacturer[];
  /** Shows the stage buttons. The server refuses anyone else anyway. */
  isAdmin: boolean;
  /** For tests: the day a stage was set, in this time zone rather than the viewer's. */
  timeZone?: string;
}

/** Each badge tone by stage: neutral before a price, then further along, the more settled. */
const TONES: Record<ManufacturerStage, 'neutral' | 'info' | 'warning' | 'success'> = {
  'specifications-received': 'neutral',
  quoted: 'info',
  sampling: 'warning',
  'in-production': 'success',
};

/** A quote's values with #57's labels, in its order: four prices, then three lead times, a row each on a wide screen. */
const QUOTE_FIELDS: readonly { key: keyof ManufacturerQuote; label: string; leadTime?: true }[] = [
  { key: 'fobPerUnit', label: 'FOB per unit (USD)' },
  { key: 'fobPerCase', label: 'FOB per case (USD)' },
  { key: 'fobTotal', label: 'FOB total (USD)' },
  { key: 'moldCost', label: 'Mold cost' },
  { key: 'sampleLeadTime', label: 'Sample lead time', leadTime: true },
  { key: 'productionLeadTime', label: 'Production lead time', leadTime: true },
  { key: 'moldLeadTime', label: 'Mold lead time', leadTime: true },
];

/** A Spec ID's manufacturers in their stage's group, from Specifications received to In production (#57). */
export function ManufacturerGroups({ specId, manufacturers, isAdmin, timeZone }: ManufacturerGroupsProps) {
  return (
    <div className="flex flex-col gap-10">
      {manufacturerGroups(manufacturers).map((group) => (
        <section key={group.stage} aria-label={group.name} className="flex flex-col gap-3">
          <div className="flex flex-col gap-0.5">
            <h2 className="flex items-center gap-2 text-lg font-semibold text-ink">
              {group.name}
              <Badge>{group.manufacturers.length}</Badge>
            </h2>
            <p className="text-sm text-ink-muted">{group.description}</p>
          </div>
          <ul className="flex flex-col gap-3">
            {group.manufacturers.map((manufacturer) => (
              <li key={manufacturer.id}>
                <ManufacturerCard specId={specId} manufacturer={manufacturer} isAdmin={isAdmin} timeZone={timeZone} />
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

function ManufacturerCard({
  specId,
  manufacturer,
  isAdmin,
  timeZone,
}: {
  specId: string;
  manufacturer: SpecIdManufacturer;
  isAdmin: boolean;
  timeZone?: string;
}) {
  const setStage = useSetManufacturerStage(specId);
  const set = manufacturer.stageSet;
  const choose = (stage: AdminStage | null) => setStage.mutate({ manufacturerId: manufacturer.id, stage });
  const choosing = (stage: AdminStage | null) => setStage.isPending && setStage.variables?.stage === stage;

  return (
    <article
      aria-label={manufacturer.name}
      className="flex flex-col gap-4 rounded-surface border border-border bg-surface p-5 shadow-sm"
    >
      <header className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 flex-col gap-0.5">
          <h3 className="text-md font-medium break-words text-ink">{manufacturer.name}</h3>
          {manufacturer.country && <p className="text-sm text-ink-muted">{manufacturer.country}</p>}
        </div>
        <Badge tone={TONES[manufacturer.stage]} className="self-start">
          {stageName(manufacturer.stage)}
        </Badge>
      </header>

      {set?.stage && (
        <p className="text-xs text-ink-subtle">
          {`Set to ${stageName(set.stage)} by ${set.by.fullName} on ${formatSavedDate(set.at, timeZone)}`}
        </p>
      )}

      <ul className="flex flex-col gap-3">
        {manufacturer.quotes.map((quote, index) => (
          <li key={index} className="flex flex-col gap-3 rounded-control bg-surface-sunken p-3">
            <p className="text-sm font-medium break-words text-ink">{shownValue(quote.itemName)}</p>
            <dl className="grid grid-cols-2 gap-x-6 gap-y-2 sm:grid-cols-3 lg:grid-cols-4">
              {QUOTE_FIELDS.map(({ key, label, leadTime }) => (
                <div key={key} className="flex min-w-0 flex-col">
                  <dt className="text-xs text-ink-subtle">{label}</dt>
                  <dd className="font-mono text-sm break-words text-ink">
                    {leadTime ? shownLeadTime(quote[key]) : shownValue(quote[key])}
                  </dd>
                </div>
              ))}
            </dl>
          </li>
        ))}
      </ul>

      {isAdmin && (
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" size="sm" loading={choosing('sampling')} disabled={setStage.isPending} onClick={() => choose('sampling')}>
            Mark as sampling
          </Button>
          <Button
            variant="secondary"
            size="sm"
            loading={choosing('in-production')}
            disabled={setStage.isPending}
            onClick={() => choose('in-production')}
          >
            Mark as in production
          </Button>
          {set?.stage && (
            <Button variant="ghost" size="sm" loading={choosing(null)} disabled={setStage.isPending} onClick={() => choose(null)}>
              Clear stage
            </Button>
          )}
        </div>
      )}
      {setStage.isError && (
        <p role="alert" className="text-sm text-danger">
          {setStage.error.message}
        </p>
      )}
    </article>
  );
}
