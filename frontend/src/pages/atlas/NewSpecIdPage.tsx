import { useSearchParams } from 'react-router-dom';
import { BackToAtlas, NewSpecIdForm, useDecodedCode, useDictionary } from '@/features/atlas';
import { PageHeader } from '@/shared/ui/PageHeader';

/** `/atlas/new`: describe a product to give it a code. `?code=` starts from that code's facts. */
export function NewSpecIdPage() {
  const [params] = useSearchParams();
  const { data: dictionary } = useDictionary();
  const { data: seed } = useDecodedCode(params.get('code'));

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-4">
        <BackToAtlas />
        <PageHeader
          title="New Spec ID"
          description='Fill in what you know. Anything you leave empty stays "not known" and can be added later.'
        />
      </div>
      <NewSpecIdForm dictionary={dictionary} seed={seed} />
    </div>
  );
}
