import { useState, type FormEvent } from 'react';
import { Button } from '@/shared/ui/Button';
import { Sheet } from '@/shared/ui/Sheet';
import { TextField } from '@/shared/ui/TextField';
import { useRejectSuggestion } from '../../application/use-decide-suggestion';
import type { Suggestion } from '../../domain/suggestion';

export interface RejectFormProps {
  suggestion: Suggestion;
  open: boolean;
  onClose(): void;
  onRejected(): void;
}

/**
 * Rejecting a suggestion, with the reason its suggester will read (#95). The
 * server checks the reason; a missing or long one is answered under the field
 * in #95's words.
 */
export function RejectForm({ suggestion, open, onClose, onRejected }: RejectFormProps) {
  const reject = useRejectSuggestion();
  const [reason, setReason] = useState('');
  const reasonErrors = reject.error?.fields.reason;

  const submit = (event: FormEvent) => {
    event.preventDefault();
    reject.mutate(
      { id: suggestion.id, reason },
      {
        onSuccess: () => {
          setReason('');
          onRejected();
        },
      },
    );
  };

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={`Reject ${suggestion.code}`}
      description={`${suggestion.suggestedBy.fullName} sees your reason.`}
    >
      <form noValidate onSubmit={submit} className="flex flex-col gap-5">
        <TextField label="Reason" name="reason" value={reason} onChange={(event) => setReason(event.target.value)} errors={reasonErrors} />
        {reject.error && !reasonErrors && (
          <p role="alert" className="text-sm text-danger">
            {reject.error.message}
          </p>
        )}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" variant="danger" loading={reject.isPending}>
            Reject
          </Button>
        </div>
      </form>
    </Sheet>
  );
}
