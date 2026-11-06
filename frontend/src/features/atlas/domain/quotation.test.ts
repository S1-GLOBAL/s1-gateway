import { describe, expect, it } from 'vitest';
import { ADA, BEN, quotationFor } from '../application/testing/quotation-fixtures';
import { fieldsOf, quotationActions, quotationStateLine } from './quotation';

describe('quotations (plan 0017)', () => {
  it('lets whoever added one edit or withdraw it while it waits, and an admin who did not, decide it', () => {
    const waiting = quotationFor();
    expect(quotationActions(waiting, { id: ADA.id, isAdmin: true })).toEqual({ edit: true, withdraw: true, decide: false });
    expect(quotationActions(waiting, { id: BEN.id, isAdmin: true })).toEqual({ edit: false, withdraw: false, decide: true });
    expect(quotationActions(waiting, { id: BEN.id, isAdmin: false })).toEqual({ edit: false, withdraw: false, decide: false });
    expect(quotationActions(quotationFor({ state: 'approved' }), { id: ADA.id, isAdmin: true })).toEqual({ edit: false, withdraw: false, decide: false });
  });

  it('says where each stands', () => {
    expect(quotationStateLine(quotationFor())).toBe('Waiting for an admin');
    expect(quotationStateLine(quotationFor({ state: 'approved', decidedBy: BEN }))).toBe("Approved by Ben Invented: it is among the Spec ID's quotes");
    expect(quotationStateLine(quotationFor({ state: 'rejected', decidedBy: BEN, reason: 'Per thousand.' }))).toBe('Rejected by Ben Invented: Per thousand.');
  });

  it('opens an edit from what it asks now: a manufacturer chosen by id, or a new one by name', () => {
    expect(fieldsOf(quotationFor()).manufacturer).toEqual({ id: 'acme' });
    expect(fieldsOf(quotationFor({ manufacturer: { kind: 'new', name: 'Invented Cups Co', country: null } })).manufacturer).toEqual({
      name: 'Invented Cups Co',
      country: '',
    });
    expect(fieldsOf(quotationFor()).values).toMatchObject({ fobPerUnit: '$0.0100', moldCost: '' });
  });
});
