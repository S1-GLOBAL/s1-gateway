import { useState, type ChangeEvent, type FormEvent } from 'react';
import { Button } from '@/shared/ui/Button';
import { PlusIcon } from '@/shared/ui/icons';
import { TextField } from '@/shared/ui/TextField';
import { useCreateTool } from '../application/use-create-tool';
import type { NewTool } from '../domain/tool';

const EMPTY: NewTool = { name: '', url: '', description: '', category: '' };

export interface CreateToolFormProps {
  /** Called after the tool is saved. */
  onCreated?(): void;
  /** Shows a Cancel button that calls this. */
  onCancel?(): void;
}

export function CreateToolForm({ onCreated, onCancel }: CreateToolFormProps) {
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
    createTool.mutate(values, {
      onSuccess: () => {
        setValues(EMPTY);
        onCreated?.();
      },
    });
  }

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-5">
      <TextField label="Name" name="name" value={values.name} onChange={update('name')} errors={fields.name} maxLength={80} required />
      <TextField
        label="URL"
        name="url"
        type="url"
        value={values.url}
        onChange={update('url')}
        errors={fields.url}
        placeholder="https://"
        hint="The full address, starting with https://"
        required
      />
      <TextField
        label="Category"
        name="category"
        value={values.category}
        onChange={update('category')}
        errors={fields.category}
        maxLength={40}
        hint="Tools with the same category are shown together."
        required
      />
      <TextField
        label="Description"
        name="description"
        value={values.description}
        onChange={update('description')}
        errors={fields.description}
        maxLength={280}
        hint="Optional. One line about what it is for."
      />
      {createTool.error && !hasFieldErrors && (
        <p role="alert" className="rounded-control bg-danger-soft px-3 py-2 text-sm text-danger">
          {createTool.error.message}
        </p>
      )}
      <div className="flex items-center justify-end gap-2 pt-1">
        {onCancel && (
          <Button variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
        )}
        <Button type="submit" loading={createTool.isPending}>
          <PlusIcon size={16} />
          Add tool
        </Button>
      </div>
    </form>
  );
}
