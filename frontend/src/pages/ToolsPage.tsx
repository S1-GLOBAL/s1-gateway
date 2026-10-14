import { CreateToolForm, ToolList, useTools } from '@/features/tools';
import { Card } from '@/shared/ui/Card';

export function ToolsPage() {
  const tools = useTools();

  return (
    <main className="mx-auto flex max-w-5xl flex-col gap-10 px-4 py-10">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold">Tools</h1>
        <p className="text-ink-muted">Internal apps and links for Source One Global staff.</p>
      </header>

      {tools.isPending ? (
        <p className="text-ink-muted">Loading tools…</p>
      ) : tools.isError ? (
        <p role="alert" className="text-danger">
          {tools.error.message}
        </p>
      ) : (
        <ToolList tools={tools.data} />
      )}

      <Card className="max-w-xl">
        <CreateToolForm />
      </Card>
    </main>
  );
}
