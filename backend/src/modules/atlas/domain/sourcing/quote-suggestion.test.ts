import { describe, expect, it } from 'vitest';
import { checkQuoteProposal, QuoteSuggestion, type QuoteProposal } from './quote-suggestion.js';

/* Every name, price and lead time here is invented: never Source One's (constraints §6). */

const ADA = '00000000-0000-4000-8000-0000000000aa';
const BEN = '00000000-0000-4000-8000-0000000000bb';
const AT = new Date('2026-11-06T08:00:00.000Z');

const PROPOSAL: QuoteProposal = {
  manufacturer: { kind: 'new', name: 'Invented Packaging Co', country: 'Nowhere' },
  values: {
    itemName: null,
    fobPerUnit: '$0.0100',
    fobPerCase: null,
    fobTotal: null,
    moldCost: null,
    moldLeadTime: null,
    sampleLeadTime: null,
    productionLeadTime: '30 days',
  },
};

function waiting() {
  return QuoteSuggestion.suggest({ id: 'q1', eventId: 'e1', specId: 's1', proposal: PROPOSAL, by: ADA, at: AT }).suggestion;
}

describe('checkQuoteProposal (ADR 0035)', () => {
  it('takes a chosen manufacturer, or a new one by name, and FOB per unit, every value trimmed and empty text nothing', () => {
    expect(checkQuoteProposal({ manufacturer: { id: ' m1 ' }, values: { fobPerUnit: ' $0.01 ', moldCost: '  ' } })).toEqual({
      ok: true,
      value: {
        manufacturer: { kind: 'existing', id: 'm1' },
        values: {
          itemName: null,
          fobPerUnit: '$0.01',
          fobPerCase: null,
          fobTotal: null,
          moldCost: null,
          moldLeadTime: null,
          sampleLeadTime: null,
          productionLeadTime: null,
        },
      },
    });
    const named = checkQuoteProposal({ manufacturer: { name: '  Invented   Co ', country: '' }, values: { fobPerUnit: '1' } });
    expect(named.ok && named.value.manufacturer).toEqual({ kind: 'new', name: 'Invented Co', country: null });
  });

  it('needs FOB per unit, and a manufacturer, chosen or named but not both', () => {
    const issues = (input: Parameters<typeof checkQuoteProposal>[0]) => {
      const checked = checkQuoteProposal(input);
      return checked.ok ? {} : checked.error.issues;
    };
    expect(issues({ manufacturer: {}, values: {} })).toEqual({
      manufacturer: ['Choose a manufacturer, or name a new one.'],
      fobPerUnit: ['Give the FOB price per unit.'],
    });
    expect(issues({ manufacturer: { id: 'm1', name: 'Invented Co' }, values: { fobPerUnit: '1' } })).toEqual({
      manufacturer: ['Choose a manufacturer, or name a new one, not both.'],
    });
  });

  it('keeps each value, name and country to its length', () => {
    const checked = checkQuoteProposal({
      manufacturer: { name: 'N'.repeat(121), country: 'C'.repeat(61) },
      values: { fobPerUnit: '1', moldCost: 'M'.repeat(201) },
    });
    expect(checked.ok ? {} : checked.error.issues).toEqual({
      manufacturerName: ['Keep the name to 120 characters.'],
      manufacturerCountry: ['Keep the country to 60 characters.'],
      moldCost: ['Keep this to 200 characters.'],
    });
  });
});

describe('QuoteSuggestion (ADR 0035)', () => {
  it('waits when added, its trail saying what it asks for', () => {
    const step = QuoteSuggestion.suggest({ id: 'q1', eventId: 'e1', specId: 's1', proposal: PROPOSAL, by: ADA, at: AT });
    expect([step.suggestion.state, step.suggestion.version, step.suggestion.quoteId]).toEqual(['waiting', 1, null]);
    expect(step.event).toMatchObject({ kind: 'suggested', by: ADA, proposalBefore: null, proposalAfter: PROPOSAL });
  });

  it('is edited or withdrawn only by whoever added it, only while it waits', () => {
    const suggestion = waiting();
    const changed = { ...PROPOSAL, values: { ...PROPOSAL.values, fobPerUnit: '$0.0200' } };
    expect(suggestion.edit(BEN, changed, AT, 'e2')).toMatchObject({ ok: false, error: { code: 'NOT_ALLOWED' } });
    const edited = suggestion.edit(ADA, changed, AT, 'e2');
    expect(edited.ok && [edited.value.suggestion.version, edited.value.event.proposalBefore]).toEqual([2, PROPOSAL]);

    const withdrawn = suggestion.withdraw(ADA, AT, 'e3');
    if (!withdrawn.ok) throw new Error('not withdrawn');
    expect(withdrawn.value.suggestion.withdraw(ADA, AT, 'e4')).toMatchObject({ ok: false, error: { code: 'QUOTE_SUGGESTION_DECIDED' } });
  });

  it('is decided by someone else: approved as a quote, or rejected with a reason', () => {
    const suggestion = waiting();
    expect(suggestion.approve(ADA, AT, 'e2', 'quote-1')).toMatchObject({ ok: false, error: { code: 'NOT_ALLOWED' } });
    const approved = suggestion.approve(BEN, AT, 'e2', 'quote-1');
    expect(approved.ok && [approved.value.suggestion.state, approved.value.suggestion.quoteId, approved.value.suggestion.decidedBy]).toEqual([
      'approved',
      'quote-1',
      BEN,
    ]);
    const rejected = suggestion.reject(BEN, 'The price is per thousand.', AT, 'e3');
    expect(rejected.ok && [rejected.value.suggestion.state, rejected.value.event.reason]).toEqual(['rejected', 'The price is per thousand.']);
  });
});
