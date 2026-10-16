import { DecodePanel, DictionaryBrowser, useDictionary } from '@/features/atlas';
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

      <section aria-labelledby="atlas-dictionary" className="flex flex-col gap-4">
        <h2 id="atlas-dictionary" className="text-lg font-semibold text-ink">
          Dictionary
        </h2>
        <DictionaryBrowser dictionary={dictionary} />
      </section>
    </div>
  );
}
