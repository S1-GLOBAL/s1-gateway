import { useState } from 'react';
import { CreateToolForm, ToolList, useTools } from '@/features/tools';
import { Button } from '@/shared/ui/Button';
import { EmptyState } from '@/shared/ui/EmptyState';
import { PlusIcon, ToolsIcon } from '@/shared/ui/icons';
import { PageHeader } from '@/shared/ui/PageHeader';
import { Sheet } from '@/shared/ui/Sheet';

export function ToolsPage() {
  const { data: tools } = useTools();
  const [adding, setAdding] = useState(false);
  const open = () => setAdding(true);
  const close = () => setAdding(false);

  return (
    <div className="flex flex-col gap-10">
      <PageHeader
        title="Tools"
        description="The apps and links Source One staff open every day."
        action={
          <Button onClick={open}>
            <PlusIcon size={16} />
            Add tool
          </Button>
        }
      />

      {tools.length === 0 ? (
        <EmptyState
          icon={<ToolsIcon size={22} />}
          title="No tools yet"
          description="Add the first app or link, and it appears here for everyone, under its category."
          action={
            <Button variant="secondary" onClick={open}>
              <PlusIcon size={16} />
              Add tool
            </Button>
          }
        />
      ) : (
        <ToolList tools={tools} />
      )}

      <Sheet open={adding} onClose={close} title="Add a tool" description="It appears for everyone, under its category.">
        <CreateToolForm onCreated={close} onCancel={close} />
      </Sheet>
    </div>
  );
}
