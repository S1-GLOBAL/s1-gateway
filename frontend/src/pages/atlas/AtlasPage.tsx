import { BuildPanel, DecodePanel, DictionaryBrowser, LookupPanel, useDictionary } from '@/features/atlas';
import { PageHeader } from '@/shared/ui/PageHeader';

export function AtlasPage() {
  const { data: dictionary } = useDictionary();

  return (
    <div className="flex flex-col gap-10">
      <PageHeader
        title="Atlas"
        description="Read, build and save S1 Spec IDs: one code for what a product physically is."
      />

      <section aria-labelledby="atlas-decode" className="flex flex-col gap-4">
        <h2 id="atlas-decode" className="text-lg font-semibold text-ink">
          Decode
        </h2>
        <DecodePanel />
      </section>

      <section aria-labelledby="atlas-build" className="flex flex-col gap-4">
        <h2 id="atlas-build" className="text-lg font-semibold text-ink">
          Build
        </h2>
        <BuildPanel dictionary={dictionary} />
      </section>

      <section aria-labelledby="atlas-lookup" className="flex flex-col gap-4">
        <h2 id="atlas-lookup" className="text-lg font-semibold text-ink">
          Look up
        </h2>
        <LookupPanel dictionary={dictionary} />
      </section>

      <section aria-labelledby="atlas-dictionary" className="flex flex-col gap-4">
        <h2 id="atlas-dictionary" className="text-lg font-semibold text-ink">
          Dictionary
        </h2>
        <DictionaryBrowser dictionary={dictionary} />
      </section>
    </div>
  );
}
