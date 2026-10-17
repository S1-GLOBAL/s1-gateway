import type { ReactNode } from 'react';
import type { AtlasDictionary, DecodedSpecId, SavedSpecId } from '../../domain/atlas';
import type { BuildForm } from '../../domain/build-facts';
import { CodePanel } from './CodePanel';
import { FactGroups } from './FactGroups';
import { MatchPanel } from './MatchPanel';

export interface SpecIdWorkspaceProps {
  dictionary: AtlasDictionary;
  form: BuildForm;
  onChange(form: BuildForm): void;
  /** The code the facts build now; undefined until the first arrives, or while the facts are refused. */
  decoded: DecodedSpecId | undefined;
  /** Why the code could not be built, when the reason is not beside a control. */
  codeError?: string;
  /** The server's reasons, by slot, for facts it refused. */
  fields: Readonly<Record<string, readonly string[]>>;
  /** Another saved Spec ID with exactly this code, or null. */
  match: SavedSpecId | null;
  /** The saved Spec ID being changed, on `/atlas/:id`. */
  ownId?: string;
  /** The top of the side column: the name, and on a new Spec ID its Save. */
  side: ReactNode;
  timeZone?: string;
}

/**
 * Building or changing one Spec ID: the facts on the left, and beside them the
 * code as it forms and whether it is already saved. At phone width the side
 * column comes first; on wide screens it stays in view.
 */
export function SpecIdWorkspace({
  dictionary,
  form,
  onChange,
  decoded,
  codeError,
  fields,
  match,
  ownId,
  side,
  timeZone,
}: SpecIdWorkspaceProps) {
  return (
    <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_24rem]">
      <FactGroups dictionary={dictionary} form={form} onChange={onChange} fields={fields} className="min-w-0" />
      <div className="order-first flex min-w-0 flex-col gap-4 lg:sticky lg:top-20 lg:order-none">
        {side}
        <CodePanel decoded={decoded} error={codeError} />
        <MatchPanel decoded={decoded} match={match} ownId={ownId} timeZone={timeZone} />
      </div>
    </div>
  );
}
