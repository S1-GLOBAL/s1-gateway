import { useState, type ChangeEvent, type FormEvent } from 'react';
import { Button } from '@/shared/ui/Button';
import { TextField } from '@/shared/ui/TextField';
import { useCreateTool } from '../application/use-create-tool';
import type { NewTool } from '../domain/tool';

const EMPTY: NewTool = { name: '', url: '', description: '', category: '' };

export function CreateToolForm() {
  const [values, setValues] = useState<NewTool>(EMPTY);
  const createTool = useCreateTool();
  const fields = createTool.error?.fields ?? {};
  const hasFieldErrors = Object.keys(fields).length > 0;

  function update(field: keyof NewTool) {
    return (event: ChangeEvent<HTMLInputElement>) => {
      const { value } = event.target;
      setValues((current) => ({ ...current, [field]: value }));
    };
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    createTool.mutate(values, { onSuccess: () => setValues(EMPTY) });
  }

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-4">
      <h2 className="text-lg font-semibold">Add a tool</h2>
      <TextField label="Name" name="name" value={values.name} onChange={update('name')} errors={fields.name} maxLength={80} required />
      <TextField label="URL" name="url" type="url" value={values.url} onChange={update('url')} errors={fields.url} placeholder="https://" required />
      <TextField label="Category" name="category" value={values.category} onChange={update('category')} errors={fields.category} maxLength={40} required />
      <TextField label="Description" name="description" value={values.description} onChange={update('description')} errors={fields.description} maxLength={280} />
      {createTool.error && !hasFieldErrors && (
        <p role="alert" className="text-sm text-danger">
          {createTool.error.message}
        </p>
      )}
      <Button type="submit" disabled={createTool.isPending} className="self-start">
        {createTool.isPending ? 'Adding…' : 'Add tool'}
      </Button>
    </form>
  );
}
