import { describe, expect, it } from 'vitest';
import type { QuoteValues } from './quote.js';
import { hasPrice, recordedAt, stageOf } from './stage.js';

/** An invented quote: never a Source One price (ADR 0027). */
const quote = (values: Partial<QuoteValues> = {}): QuoteValues => ({
  itemName: 'Invented PP cup',
  fobPerUnit: null,
  fobPerCase: null,
  fobTotal: null,
  moldCost: null,
  moldLeadTime: null,
  sampleLeadTime: null,
  productionLeadTime: null,
  ...values,
});

describe('stageOf', () => {
  it('is quoted when a quote has a per-unit price, or only a per-case one', () => {
    expect(stageOf([quote({ fobPerUnit: '$0.0123' })], null)).toBe('quoted');
    expect(stageOf([quote({ fobPerCase: '$12.30' })], null)).toBe('quoted');
  });

  it('is specifications received when no quote has a price', () => {
    expect(stageOf([quote({ fobTotal: '$1,230.00', sampleLeadTime: '7' })], null)).toBe('specifications-received');
    expect(stageOf([], null)).toBe('specifications-received');
  });

  it('takes the stage an admin set over the quotes, and the quotes again once it is cleared', () => {
    expect(stageOf([quote({ fobPerUnit: '$0.0123' })], 'sampling')).toBe('sampling');
    expect(stageOf([quote()], 'in-production')).toBe('in-production');
    expect(stageOf([quote({ fobPerUnit: '$0.0123' })], null)).toBe('quoted');
  });
});

describe('recordedAt', () => {
  const at = new Date('2026-10-23T09:00:00.000Z');

  it('keeps a clock that is already later, and moves one that is not 1ms on', () => {
    expect(recordedAt(null, at)).toBe(at);
    expect(recordedAt(at, new Date(at.getTime() + 60_000))).toEqual(new Date(at.getTime() + 60_000));
    expect(recordedAt(at, at)).toEqual(new Date(at.getTime() + 1));
    expect(recordedAt(at, new Date(at.getTime() - 60_000))).toEqual(new Date(at.getTime() + 1));
  });
});

describe('hasPrice', () => {
  it.each(['N/A', '-', '/', '', null])('does not take %j for a price', (value) => {
    expect(hasPrice(value)).toBe(false);
  });

  it.each(['$0.0350', '12', '$0.05 per 1000 pouches'])('takes %j for a price', (value) => {
    expect(hasPrice(value)).toBe(true);
  });
});
