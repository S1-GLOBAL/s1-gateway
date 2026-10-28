import { useState, type FormEvent } from 'react';
import { Button } from '@/shared/ui/Button';
import { ErrorState } from '@/shared/ui/ErrorState';
import { SelectField } from '@/shared/ui/SelectField';
import { Sheet } from '@/shared/ui/Sheet';
import { SkeletonText } from '@/shared/ui/Skeleton';
import { TextAreaField } from '@/shared/ui/TextAreaField';
import { TextField } from '@/shared/ui/TextField';
import { useEditSuggestion, useSuggestChange } from '../../application/use-suggest-change';
import { useDictionaryUsage } from '../../application/use-suggestions';
import { RULE_LABELS, type AtlasDictionary, type SlotKey, type SlotRule } from '../../domain/atlas';
import { usageLine, type Suggestion } from '../../domain/suggestion';
import {
  codeHint,
  draftProposal,
  isRoundShape,
  replacementOptions,
  ruledSlots,
  rulesOf,
  startDraft,
  SUGGESTION_COPY,
  suggestionIntro,
  suggestionTitle,
  targetCode,
  type DraftContext,
  type SuggestionDraft,
  type SuggestionTarget,
} from '../../domain/suggestion-form';
import { dictionaryOptions } from '../dictionary-options';

/** What the form is opened for: a new suggestion, or the suggester's waiting one to edit. */
export interface SuggestionRequest {
  target: SuggestionTarget;
  editing: Suggestion | null;
}

export interface SuggestionFormProps {
  /** Null while the form is closed. */
  request: SuggestionRequest | null;
  dictionary: AtlasDictionary;
  onClose(): void;
  /** Once sent, with #95's line to show where the form was opened from. */
  onSent(message: string): void;
}

const RULE_OPTIONS = (Object.keys(RULE_LABELS) as SlotRule[]).map((rule) => ({ value: rule, label: RULE_LABELS[rule] }));

/** The problems each kind shows by its own field; any other is said above the buttons. */
const FIELDS_SHOWN: Record<SuggestionTarget['kind'], readonly string[]> = {
  add: ['code', 'meaning', 'searchWords', 'rules'],
  edit: ['code', 'newCode', 'meaning', 'searchWords'],
  delete: ['replacement'],
  rules: ['rules'],
};

/**
 * Suggesting a change to the dictionary, or editing a waiting suggestion (#95):
 * one form whose fields follow the kind. Adding or editing an option has its
 * code, wording and search words, and a new product type its rules, copied
 * from another; deleting an option in use asks what its Spec IDs become; a
 * rules change has a rule per field. The server checks everything, and each
 * problem shows by its field.
 */
export function SuggestionForm({ request, dictionary, onClose, onSent }: SuggestionFormProps) {
  const target = request?.target;
  return (
    <Sheet
      open={request !== null}
      onClose={onClose}
      title={!target ? 'Suggest a change' : request?.editing ? 'Edit your suggestion' : suggestionTitle(target, dictionary)}
      description={target ? suggestionIntro(target, dictionary) : undefined}
    >
      {request && (
        <Loaded
          key={`${request.target.kind}:${request.target.slot}:${'code' in request.target ? request.target.code : ''}:${request.editing?.id ?? ''}`}
          request={request}
          dictionary={dictionary}
          onCancel={onClose}
          onSent={onSent}
        />
      )}
    </Sheet>
  );
}

interface LoadedProps {
  request: SuggestionRequest;
  dictionary: AtlasDictionary;
  onCancel(): void;
  onSent(message: string): void;
}

/** Waits for the option's use, so the form says how many Spec IDs a change would touch. */
function Loaded({ request, dictionary, onCancel, onSent }: LoadedProps) {
  const { target } = request;
  const code = target.kind === 'add' ? null : target.code;
  const usage = useDictionaryUsage(target.slot, code ?? '', code !== null);
  if (usage.error) return <ErrorState message={usage.error.message} onRetry={() => void usage.refetch()} />;
  if (code !== null && usage.isPending) {
    return (
      <div className="flex flex-col gap-3" aria-busy="true">
        {[0, 1, 2].map((line) => (
          <SkeletonText key={line} size="sm" className="w-3/4" order={line} />
        ))}
      </div>
    );
  }

  const context: DraftContext = {
    dictionary,
    currentWords:
      target.kind === 'edit'
        ? (dictionary.slots.find((slot) => slot.key === target.slot)?.values.find((value) => value.code === target.code)
            ?.searchWords ?? [])
        : [],
    usage: usage.data ?? 0,
  };
  return <Fields request={request} context={context} onCancel={onCancel} onSent={onSent} />;
}

interface FieldsProps {
  request: SuggestionRequest;
  context: DraftContext;
  onCancel(): void;
  onSent(message: string): void;
}

function Fields({ request, context, onCancel, onSent }: FieldsProps) {
  const { target, editing } = request;
  const { dictionary } = context;
  const [draft, setDraft] = useState<SuggestionDraft>(() => startDraft(target, context, editing?.proposal ?? null));
  const suggest = useSuggestChange();
  const edit = useEditSuggestion();
  const sending = editing ? edit : suggest;
  const fields = sending.error?.fields ?? {};
  const proposal = draftProposal(target, draft, context);
  const used = target.kind === 'add' ? null : usageLine(context.usage, proposal);
  const round = (target.kind === 'edit' || target.kind === 'delete') && isRoundShape(target.slot, target.code);
  const set = (change: Partial<SuggestionDraft>) => setDraft((current) => ({ ...current, ...change }));

  // A delete in no use has no replacement field.
  const shown = target.kind === 'delete' && context.usage === 0 ? [] : FIELDS_SHOWN[target.kind];
  const others = Object.entries(fields)
    .filter(([field]) => !shown.includes(field))
    .flatMap(([, messages]) => messages);
  const general = sending.error && (Object.keys(fields).length === 0 ? [sending.error.message] : others);

  async function submit(event: FormEvent) {
    event.preventDefault();
    const input = { slot: target.slot, code: targetCode(target, draft), proposal };
    try {
      if (editing) await edit.mutateAsync({ id: editing.id, version: editing.version, input });
      else await suggest.mutateAsync(input);
      onSent(SUGGESTION_COPY.sent);
    } catch {
      // The answer is shown from the mutation's error.
    }
  }

  return (
    <form noValidate onSubmit={submit} className="flex flex-col gap-5">
      {used && <p className="text-sm text-ink-muted">{used}</p>}

      {(target.kind === 'add' || target.kind === 'edit') && (
        <>
          <TextField
            label="Code"
            name="code"
            autoComplete="off"
            value={draft.code}
            disabled={round || (target.kind === 'add' && target.code !== undefined)}
            hint={round ? SUGGESTION_COPY.roundLocked : codeHint(target.slot)}
            errors={[...(fields.code ?? []), ...(fields.newCode ?? [])]}
            onChange={(event) => set({ code: event.target.value })}
          />
          <TextField
            label="Wording"
            name="meaning"
            value={draft.meaning}
            errors={fields.meaning}
            onChange={(event) => set({ meaning: event.target.value })}
          />
          <TextAreaField
            label={SUGGESTION_COPY.searchWordsLabel}
            name="searchWords"
            value={draft.words}
            hint={SUGGESTION_COPY.searchWordsHint}
            errors={fields.searchWords}
            onChange={(event) => set({ words: event.target.value })}
          />
        </>
      )}

      {target.kind === 'delete' &&
        (round ? (
          <p className="rounded-control bg-warning-soft px-3 py-2 text-sm text-warning">{SUGGESTION_COPY.roundLocked}</p>
        ) : context.usage > 0 ? (
          <SelectField
            label={SUGGESTION_COPY.replacementQuestion}
            name="replacement"
            value={draft.replacement}
            options={[{ value: '', label: 'Choose one' }, ...replacementOptions(dictionary, target.slot, target.code)]}
            hint={target.slot === 'productType' ? SUGGESTION_COPY.productTypeReplacement : undefined}
            errors={fields.replacement}
            onChange={(event) => set({ replacement: event.target.value })}
          />
        ) : (
          <p className="text-sm text-ink-muted">No saved Spec ID holds it.</p>
        ))}

      {((target.kind === 'add' && target.slot === 'productType') || target.kind === 'rules') && (
        <Rules
          dictionary={dictionary}
          rules={draft.rules}
          copyable={target.kind === 'add'}
          editing={editing !== null}
          errors={fields.rules}
          onChange={(rules) => set({ rules })}
        />
      )}

      {general && general.length > 0 && (
        <p role="alert" className="text-sm text-danger">
          {general.join(' ')}
        </p>
      )}

      <div className="flex justify-end gap-2">
        <Button type="button" variant="secondary" onClick={onCancel}>
          Cancel
        </Button>
        {!(target.kind === 'delete' && round) && (
          <Button type="submit" loading={sending.isPending}>
            {editing ? 'Save edit' : 'Suggest'}
          </Button>
        )}
      </div>
    </form>
  );
}

interface RulesProps {
  dictionary: AtlasDictionary;
  rules: Partial<Record<SlotKey, SlotRule>>;
  /** A new product type: its rules start as a copy of another's. */
  copyable: boolean;
  /** A waiting suggestion's rules, which came from no product type, until one is chosen. */
  editing: boolean;
  errors: readonly string[] | undefined;
  onChange(rules: Partial<Record<SlotKey, SlotRule>>): void;
}

/** A rule for each ruled field, in code order; a new product type's start as a copy of the one chosen. */
function Rules({ dictionary, rules, copyable, editing, errors, onChange }: RulesProps) {
  const productTypes = dictionaryOptions(dictionary, 'productType');
  // A new product type's rules start as the first product type's (`startDraft`).
  const [copiedFrom, setCopiedFrom] = useState(editing ? '' : (productTypes[0]?.value ?? ''));

  return (
    <fieldset className="flex flex-col gap-4">
      <legend className="text-md font-medium text-ink">Which slots apply</legend>
      {copyable && (
        <SelectField
          label="Copy the rules from"
          value={copiedFrom}
          options={copiedFrom === '' ? [{ value: '', label: 'Choose one' }, ...productTypes] : productTypes}
          hint="Then change any that differ."
          onChange={(event) => {
            setCopiedFrom(event.target.value);
            onChange(rulesOf(dictionary, event.target.value));
          }}
        />
      )}
      {errors && errors.length > 0 && (
        <p role="alert" className="text-sm text-danger">
          {errors.join(' ')}
        </p>
      )}
      <div className="grid gap-4 sm:grid-cols-2">
        {ruledSlots(dictionary).map((slot) => (
          <SelectField
            key={slot.key}
            label={slot.name}
            value={rules[slot.key] ?? ''}
            options={rules[slot.key] ? RULE_OPTIONS : [{ value: '', label: 'Choose one' }, ...RULE_OPTIONS]}
            onChange={(event) => onChange({ ...rules, [slot.key]: event.target.value as SlotRule })}
          />
        ))}
      </div>
    </fieldset>
  );
}
