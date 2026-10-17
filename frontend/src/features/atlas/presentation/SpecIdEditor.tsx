import { History } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { isSignInRequired } from '@/features/accounts';
import { Badge } from '@/shared/ui/Badge';
import { Button } from '@/shared/ui/Button';
import { Card } from '@/shared/ui/Card';
import { TextField } from '@/shared/ui/TextField';
import { SpecIdChangedError } from '../application/spec-id-changed-error';
import { SpecIdExistsError } from '../application/spec-id-exists-error';
import { useSpecIdDraft } from '../application/use-spec-id-draft';
import { useUpdateSpecId } from '../application/use-update-spec-id';
import type { AtlasDictionary, SavedSpecId } from '../domain/atlas';
import { isFormChanged, type BuildForm } from '../domain/build-facts';
import { formatSavedDate } from '../domain/format-saved-date';
import { notKnownCount } from '../domain/spec-id-summary';
import { toBuildForm } from '../domain/to-build-form';
import { BackToAtlas } from './BackToAtlas';
import { HistorySheet } from './HistorySheet';
import { Alert } from './workspace/Alert';
import { SpecIdWorkspace } from './workspace/SpecIdWorkspace';

export interface SpecIdEditorProps {
  dictionary: AtlasDictionary;
  saved: SavedSpecId;
  /** Asks for the Spec ID again, as now saved. */
  onReload(): Promise<SavedSpecId | null>;
  /** Shown once on arrival: the message a save on `/atlas/new` left. */
  notice?: string;
  timeZone?: string;
}

/**
 * A saved Spec ID, open for change: its header with History and Save changes,
 * the workspace filled in, and its name. A change starts from the version
 * opened and stays on it until saved or reloaded, so a save never overwrites
 * someone else's.
 */
export function SpecIdEditor({ dictionary, saved, onReload, notice: arrival, timeZone }: SpecIdEditorProps) {
  const { rules } = dictionary;
  const [base, setBase] = useState(saved);
  const baseline = useMemo(() => toBuildForm(base), [base]);
  const draft = useSpecIdDraft(rules, () => toBuildForm(saved), saved.id);
  const [name, setName] = useState(saved.name);
  const [notice, setNotice] = useState(arrival);
  const [historyOpen, setHistoryOpen] = useState(false);
  const update = useUpdateSpecId(saved.id);
  const refused = update.error?.code === 'INVALID_SPEC_ID' ? update.error : undefined;
  const changed = isFormChanged(baseline, draft.form, rules) || name.trim() !== base.name;

  function reset(next: SavedSpecId) {
    setBase(next);
    draft.setForm(toBuildForm(next));
    setName(next.name);
    update.reset();
  }

  // A change makes the last save's answer stale, so it goes.
  function change(form: BuildForm) {
    draft.setForm(form);
    update.reset();
    setNotice(undefined);
  }

  async function saveChanges() {
    setNotice(undefined);
    try {
      const next = await update.mutateAsync({ name, facts: draft.facts, version: base.version });
      reset(next);
      setNotice(next.code === base.code ? 'Saved.' : `Saved. The code is now ${next.code}.`);
    } catch {
      // The answer is shown from `update.error`.
    }
  }

  async function reload() {
    const next = await onReload();
    if (next) reset(next);
  }

  const missing = notKnownCount(base);
  const lastBy = base.updatedBy ?? base.savedBy;
  const lastAt = base.updatedAt ?? base.savedAt;

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-4">
        <BackToAtlas />
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex min-w-0 flex-col gap-1.5">
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="min-w-0 text-xl font-semibold break-words text-ink">{base.name}</h1>
              {missing > 0 ? <Badge tone="warning">{`${missing} not known`}</Badge> : <Badge tone="accent">Complete</Badge>}
            </div>
            <p className="text-sm text-ink-muted">
              {`Last updated by ${lastBy.fullName} on ${formatSavedDate(lastAt, timeZone)} · created by ${base.savedBy.fullName} on ${formatSavedDate(base.savedAt, timeZone)}`}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <Button
              variant="secondary"
              aria-label="History"
              title="History"
              onClick={() => setHistoryOpen(true)}
              className="w-10 px-0"
            >
              <History size={18} strokeWidth={1.75} aria-hidden="true" />
            </Button>
            <Button onClick={saveChanges} disabled={!changed} loading={update.isPending}>
              Save changes
            </Button>
          </div>
        </div>
      </header>

      <SpecIdWorkspace
        dictionary={dictionary}
        form={draft.form}
        onChange={change}
        decoded={draft.decoded}
        codeError={draft.codeError}
        fields={draft.fields ?? refused?.fields ?? {}}
        match={draft.match}
        ownId={base.id}
        side={
          <Card className="flex flex-col gap-4">
            <TextField
              label="Name"
              hint="Up to 120 characters."
              value={name}
              onChange={(event) => {
                setName(event.target.value);
                update.reset();
                setNotice(undefined);
              }}
              errors={refused?.fields.name}
              autoComplete="off"
            />
            {notice && (
              <p role="status" className="text-sm text-ink">
                {notice}
              </p>
            )}
            <UpdateOutcome error={update.error} onReload={reload} />
          </Card>
        }
        timeZone={timeZone}
      />

      <HistorySheet
        id={base.id}
        name={base.name}
        open={historyOpen}
        onClose={() => setHistoryOpen(false)}
        timeZone={timeZone}
      />
    </div>
  );
}

function UpdateOutcome({ error, onReload }: { error: ReturnType<typeof useUpdateSpecId>['error']; onReload(): void }) {
  if (error instanceof SpecIdExistsError) {
    const { existing } = error;
    return (
      <div role="status" className="flex flex-col gap-2 text-sm text-ink">
        <p>
          {`This change gives it the same code as "${existing.name}", which is already saved. Open that one instead, or change a fact.`}
        </p>
        <Link
          to={`/atlas/${existing.id}`}
          className="self-start font-medium text-accent-ink underline-offset-4 hover:underline"
        >
          Open
        </Link>
      </div>
    );
  }
  if (error instanceof SpecIdChangedError) {
    return (
      <div role="status" className="flex flex-col items-start gap-2 text-sm text-ink">
        <p>Someone changed this Spec ID while you were editing. Reload to see their changes, then make yours again.</p>
        <Button variant="secondary" size="sm" onClick={onReload}>
          Reload
        </Button>
      </div>
    );
  }
  if (isSignInRequired(error)) return <Alert message="Sign in to save Spec IDs." />;
  // Slot and name problems are already beside their controls.
  if (error && error.code !== 'INVALID_SPEC_ID') return <Alert message={error.message} />;
  return null;
}
