import { useState } from 'react';
import type { SlotRuleEntry } from '../domain/atlas';
import { toFacts, type BuildForm } from '../domain/build-facts';
import { useEncodeSpecId } from './use-encode-spec-id';
import { useExactMatch } from './use-exact-match';

/**
 * A Spec ID being built or changed: the form, the facts it sends, the code
 * the server builds from them, and any other saved Spec ID that already has
 * that code. `ownId` is the Spec ID being changed, never its own match.
 */
export function useSpecIdDraft(rules: readonly SlotRuleEntry[], initial: () => BuildForm, ownId?: string) {
  const [form, setForm] = useState<BuildForm>(initial);
  const facts = toFacts(form, rules);
  const encoded = useEncodeSpecId(facts);
  // A refused set of facts has no code; its reasons belong beside the controls.
  const refused = encoded.error?.code === 'INVALID_SPEC_ID' ? encoded.error : undefined;
  const decoded = refused ? undefined : encoded.data;
  const exact = useExactMatch(decoded?.code);
  const match = exact.data && exact.data.id !== ownId ? exact.data : null;

  return {
    form,
    setForm,
    facts,
    decoded,
    /** The server's reasons, by slot, for facts it refused; undefined while it refuses none. */
    fields: refused?.fields,
    /** Any other reason the code could not be built. */
    codeError: encoded.error && !refused ? encoded.error.message : undefined,
    match,
  };
}
