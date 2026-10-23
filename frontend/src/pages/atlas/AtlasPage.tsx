import { useState } from 'react';
import { AtlasLibrary, DictionarySheet, NewSpecIdLink, useDictionary } from '@/features/atlas';
import { Button } from '@/shared/ui/Button';
import { BookOpenIcon } from '@/shared/ui/icons';
import { PageHeader } from '@/shared/ui/PageHeader';

/** `/atlas`: the library of saved Spec IDs, one search box, and the dictionary. */
export function AtlasPage() {
  const { data: dictionary } = useDictionary();
  const [dictionaryOpen, setDictionaryOpen] = useState(false);

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title="Atlas"
        description="One code for what a product physically is. Find a product, or describe a new one."
        action={
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="secondary" onClick={() => setDictionaryOpen(true)}>
              <BookOpenIcon size={16} />
              Dictionary
            </Button>
            <NewSpecIdLink />
          </div>
        }
      />
      <AtlasLibrary dictionary={dictionary} />
      <DictionarySheet dictionary={dictionary} open={dictionaryOpen} onClose={() => setDictionaryOpen(false)} />
    </div>
  );
}
