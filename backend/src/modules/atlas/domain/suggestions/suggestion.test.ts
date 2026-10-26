import { describe, expect, it } from 'vitest';
import type { Proposal } from './proposal.js';
import { SuggestionDecidedError, SuggestionNotAllowedError } from './suggestion.errors.js';
import { Suggestion } from './suggestion.js';

const AT = new Date('2026-10-27T08:00:00.000Z');
const LATER = new Date('2026-10-27T09:00:00.000Z');
const PROPOSAL: Proposal = { kind: 'add', meaning: 'Polymer, invented', searchWords: [], rules: null };
const EDITED: Proposal = { kind: 'add', meaning: 'Polymer, invented again', searchWords: ['invented'], rules: null };

function suggested() {
  return Suggestion.suggest({
    id: 's1',
    eventId: 'e1',
    target: { slot: 'material', code: 'AZZ' },
    proposal: PROPOSAL,
    by: 'ada',
    at: AT,
  });
}

describe('Suggestion', () => {
  it('waits at version 1, with a suggested event holding what it asks for', () => {
    const { suggestion, event } = suggested();
    expect(suggestion.state).toBe('waiting');
    expect(suggestion.version).toBe(1);
    expect(suggestion.kind).toBe('add');
    expect(event).toEqual({
      id: 'e1',
      suggestionId: 's1',
      kind: 'suggested',
      by: 'ada',
      at: AT,
      proposalBefore: null,
      proposalAfter: PROPOSAL,
      reason: null,
    });
  });

  it('is edited by its suggester, raising its version and keeping what it said before', () => {
    const result = suggested().suggestion.edit('ada', EDITED, LATER, 'e2');
    expect(result.ok && result.value.suggestion.version).toBe(2);
    expect(result.ok && result.value.suggestion.proposal).toEqual(EDITED);
    expect(result.ok && result.value.event).toMatchObject({
      kind: 'edited',
      proposalBefore: PROPOSAL,
      proposalAfter: EDITED,
    });
  });

  it('is withdrawn by its suggester', () => {
    const result = suggested().suggestion.withdraw('ada', LATER, 'e2');
    expect(result.ok && result.value.suggestion.state).toBe('withdrawn');
    expect(result.ok && result.value.suggestion.decidedAt).toEqual(LATER);
    expect(result.ok && result.value.event.kind).toBe('withdrawn');
  });

  it("refuses anyone else's edit or withdrawal", () => {
    const { suggestion } = suggested();
    const edited = suggestion.edit('ben', EDITED, LATER, 'e2');
    const withdrawn = suggestion.withdraw('ben', LATER, 'e2');
    expect(!edited.ok && edited.error).toBeInstanceOf(SuggestionNotAllowedError);
    expect(!withdrawn.ok && withdrawn.error).toBeInstanceOf(SuggestionNotAllowedError);
  });

  it('refuses an edit once it no longer waits', () => {
    const withdrawn = suggested().suggestion.withdraw('ada', LATER, 'e2');
    if (!withdrawn.ok) throw new Error('setup failed');
    const edited = withdrawn.value.suggestion.edit('ada', EDITED, LATER, 'e3');
    expect(!edited.ok && edited.error).toBeInstanceOf(SuggestionDecidedError);
  });
});
