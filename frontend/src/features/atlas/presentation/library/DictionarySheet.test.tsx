import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { AppError } from '@/shared/application/app-error';
import type { SuggestionsGateway } from '../../application/suggestions-gateway';
import { SuggestionsGatewayProvider } from '../../application/suggestions-gateway-context';
import type { AtlasDictionary } from '../../domain/atlas';
import type { Suggestion } from '../../domain/suggestion';
import { DictionarySheet } from './DictionarySheet';

/* Invented people and options only (constraints §6). */
const ADA = { id: 'ada', fullName: 'Ada Invented' };
const BEN = { id: 'ben', fullName: 'Ben Invented' };

const DICTIONARY: AtlasDictionary = {
  release: 'S2 0.1.0',
  approvedOn: '2026-10-19',
  slots: [
    { key: 'productType', name: 'Product type', values: [{ code: 'BLD', meaning: 'Bowl lid', searchWords: [] }, { code: 'BWL', meaning: 'Bowl', searchWords: [] }] },
    { key: 'material', name: 'Material', values: [{ code: 'APP', meaning: 'Polymer, PP', searchWords: [] }, { code: 'APS', meaning: 'Polymer, PS', searchWords: ['styrene foam', 'invented foam'] }] },
    { key: 'shape', name: 'Shape', values: [{ code: 'RD', meaning: 'Round', searchWords: [] }, { code: 'SQ', meaning: 'Square', searchWords: [] }] },
  ],
  rules: [
    { productType: 'BLD', slot: 'coating', rule: 'applies' },
    { productType: 'BLD', slot: 'wall', rule: 'never' },
    { productType: 'BWL', slot: 'coating', rule: 'never' },
    { productType: 'BWL', slot: 'wall', rule: 'applies' },
  ],
  change: null,
};

/** An approved suggestion, the shape the fake answers a new one from. */
const APPROVED_WORDS: Suggestion = {
  id: 'd1',
  kind: 'edit',
  slot: 'material',
  code: 'APS',
  proposal: { kind: 'edit', newCode: null, meaning: null, searchWords: ['styrene foam', 'invented foam'] },
  state: 'approved',
  version: 1,
  suggestedBy: ADA,
  suggestedAt: new Date('2026-10-26T08:00:00.000Z'),
  decidedBy: BEN,
  decidedAt: new Date('2026-10-26T09:00:00.000Z'),
  reason: null,
  changeNumber: 1,
};

const pending = () => new Promise<never>(() => undefined);

function gatewayWith(overrides: Partial<SuggestionsGateway> = {}): SuggestionsGateway {
  return {
    suggest: vi.fn(async (input) => ({ ...APPROVED_WORDS, id: 'new', kind: input.proposal.kind, slot: input.slot, code: input.code, proposal: input.proposal, state: 'waiting' as const })),
    edit: pending,
    usage: async () => 0,
    list: async () => [],
    get: pending,
    waitingCount: async () => 0,
    approve: pending,
    reject: pending,
    withdraw: pending,
    ...overrides,
  };
}

function renderSheet(gateway: SuggestionsGateway = gatewayWith(), dictionary: AtlasDictionary = DICTIONARY) {
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <SuggestionsGatewayProvider gateway={gateway}>
        <DictionarySheet dictionary={dictionary} open onClose={() => undefined} timeZone="UTC" />
      </SuggestionsGatewayProvider>
    </QueryClientProvider>,
  );
  return gateway;
}

const list = (name: string) => within(screen.getByRole('article', { name }));

/** Opens an option, then one of its Suggest buttons, and answers the form that opens. */
async function suggestFor(listName: string, meaning: string, action: 'Suggest edit' | 'Suggest delete', title: string) {
  const option = list(listName).getByRole('button', { name: meaning });
  if (option.getAttribute('aria-expanded') !== 'true') fireEvent.click(option);
  fireEvent.click(list(listName).getByRole('button', { name: action }));
  return within(await screen.findByRole('dialog', { name: title }));
}

describe('DictionarySheet, its header', () => {
  it("names the release and the day it was approved before the first change, in #95's words", () => {
    renderSheet();
    expect(screen.getByRole('dialog', { name: 'Dictionary' }).getAttribute('aria-describedby')).toBeTruthy();
    expect(screen.getByText('S2, approved 19 October 2026.')).toBeTruthy();
  });

  it("names the latest change and its day, in #95's words", () => {
    renderSheet(gatewayWith(), { ...DICTIONARY, change: { number: 3, at: new Date('2026-10-27T09:30:00.000Z') } });
    expect(screen.getByText('S2, change 3, 27 October 2026.')).toBeTruthy();
  });
});

describe('DictionarySheet, suggesting', () => {
  it("shows each option's approved search words under its wording", async () => {
    renderSheet();
    expect(await list('Material').findByText('styrene foam, invented foam')).toBeTruthy();
  });

  it("adds an option, with the material hint and search words, and says it was sent in #95's words", async () => {
    const gateway = renderSheet();
    fireEvent.click(list('Material').getByRole('button', { name: 'Suggest an option for Material' }));
    const form = within(await screen.findByRole('dialog', { name: 'Suggest an option for Material' }));

    expect(form.getByText('The first letter is its family: B is paper and paperboard.')).toBeTruthy();
    expect(form.getByText('One per line. Words people paste that mean this, like “sugarcane fibre”.')).toBeTruthy();
    fireEvent.change(form.getByLabelText('Code'), { target: { value: 'azz' } });
    fireEvent.change(form.getByLabelText('Wording'), { target: { value: 'Polymer, invented' } });
    fireEvent.change(form.getByLabelText('Search words'), { target: { value: 'invented polymer\ncane pulp' } });
    fireEvent.click(form.getByRole('button', { name: 'Suggest' }));

    expect(await screen.findByText('Suggested. An admin will review it.')).toBeTruthy();
    expect(gateway.suggest).toHaveBeenCalledWith({
      slot: 'material',
      code: 'AZZ',
      proposal: { kind: 'add', meaning: 'Polymer, invented', searchWords: ['invented polymer', 'cane pulp'], rules: null },
    });
  });

  it("shows each of the server's problems beside its field", async () => {
    const fields = { code: ['APS is already Polymer, PS.'], searchWords: ['“styrene foam” already finds APS (Polymer, PS).'] };
    renderSheet(gatewayWith({ suggest: async () => Promise.reject(new AppError('VALIDATION_FAILED', 'The suggestion is not valid.', fields)) }));
    fireEvent.click(list('Material').getByRole('button', { name: 'Suggest an option for Material' }));
    const form = within(await screen.findByRole('dialog', { name: 'Suggest an option for Material' }));
    fireEvent.click(form.getByRole('button', { name: 'Suggest' }));

    expect(await form.findByText('APS is already Polymer, PS.')).toBeTruthy();
    expect(form.getByLabelText('Code').getAttribute('aria-invalid')).toBe('true');
    expect(form.getByText('“styrene foam” already finds APS (Polymer, PS).')).toBeTruthy();
    expect(form.getByLabelText('Search words').getAttribute('aria-invalid')).toBe('true');
    expect(form.queryByRole('alert')).toBeNull();
  });

  it('edits an option from what it is today, and says its Spec IDs change too once its code does', async () => {
    const gateway = renderSheet(gatewayWith({ usage: async () => 3 }));
    const form = await suggestFor('Material', 'Polymer, PS', 'Suggest edit', 'Suggest an edit to APS');

    expect(await form.findByText('Used by 3 saved Spec IDs.')).toBeTruthy();
    expect((form.getByLabelText('Wording') as HTMLInputElement).value).toBe('Polymer, PS');
    expect((form.getByLabelText('Search words') as HTMLTextAreaElement).value).toBe('styrene foam\ninvented foam');

    fireEvent.change(form.getByLabelText('Code'), { target: { value: 'APZ' } });
    expect(form.getByText('Used by 3 saved Spec IDs. If approved, they change too.')).toBeTruthy();
    fireEvent.click(form.getByRole('button', { name: 'Suggest' }));

    await waitFor(() =>
      expect(gateway.suggest).toHaveBeenCalledWith({
        slot: 'material',
        code: 'APS',
        proposal: { kind: 'edit', newCode: 'APZ', meaning: null, searchWords: null },
      }),
    );
  });

  it("waits for the option's use before the form shows its fields", async () => {
    renderSheet(gatewayWith({ usage: pending }));
    const form = await suggestFor('Material', 'Polymer, PS', 'Suggest delete', 'Suggest deleting APS');

    expect(form.getByText((_, element) => element?.getAttribute('aria-busy') === 'true')).toBeTruthy();
    expect(form.queryByRole('button', { name: 'Suggest' })).toBeNull();
  });

  it("says when the option's use cannot be read, with Try again", async () => {
    let fail = true;
    renderSheet(
      gatewayWith({
        usage: async () => {
          if (fail) throw new AppError('NETWORK', 'Cannot reach the server. Check your connection and try again.');
          return 0;
        },
      }),
    );
    const form = await suggestFor('Material', 'Polymer, PS', 'Suggest delete', 'Suggest deleting APS');

    expect(await form.findByText('Cannot reach the server. Check your connection and try again.')).toBeTruthy();
    fail = false;
    fireEvent.click(form.getByRole('button', { name: 'Try again' }));
    expect(await form.findByRole('button', { name: 'Suggest' })).toBeTruthy();
  });

  it('deletes an option in use, asking what its Spec IDs become, with Not known (Y)', async () => {
    const gateway = renderSheet(gatewayWith({ usage: async () => 2 }));
    const form = await suggestFor('Material', 'Polymer, PS', 'Suggest delete', 'Suggest deleting APS');

    const becomes = await form.findByRole('combobox', { name: 'What should those Spec IDs become?' });
    expect(within(becomes).getAllByRole('option').map((option) => option.textContent)).toEqual([
      'Choose one',
      'APP — Polymer, PP',
      'Not known (Y)',
    ]);
    expect(form.getByText('Used by 2 saved Spec IDs. If approved, they change too.')).toBeTruthy();
    fireEvent.change(becomes, { target: { value: 'Y' } });
    fireEvent.click(form.getByRole('button', { name: 'Suggest' }));

    await waitFor(() =>
      expect(gateway.suggest).toHaveBeenCalledWith({ slot: 'material', code: 'APS', proposal: { kind: 'delete', replacement: 'Y' } }),
    );
  });

  it("deletes a product type in use only into another product type, in #95's words", async () => {
    renderSheet(gatewayWith({ usage: async () => 1 }));
    const form = await suggestFor('Product type', 'Bowl lid', 'Suggest delete', 'Suggest deleting BLD');

    const becomes = await form.findByRole('combobox', { name: 'What should those Spec IDs become?' });
    expect(within(becomes).getAllByRole('option').map((option) => option.textContent)).toEqual(['Choose one', 'BWL — Bowl']);
    expect(form.getByText("Pick the product type they become. Product type can't be not known.")).toBeTruthy();
  });

  it("locks RD's letters, and does not offer to delete it, in #95's words", async () => {
    renderSheet();
    const lock = "RD is how Atlas knows a shape is round, so its letters can't change and it can't be deleted.";

    const editing = await suggestFor('Shape', 'Round', 'Suggest edit', 'Suggest an edit to RD');
    expect((await editing.findByLabelText('Code') as HTMLInputElement).disabled).toBe(true);
    expect(editing.getByText(lock)).toBeTruthy();
    expect((editing.getByLabelText('Wording') as HTMLInputElement).disabled).toBe(false);
    fireEvent.click(editing.getByRole('button', { name: 'Cancel' }));

    const deleting = await suggestFor('Shape', 'Round', 'Suggest delete', 'Suggest deleting RD');
    expect(await deleting.findByText(lock)).toBeTruthy();
    expect(deleting.queryByRole('button', { name: 'Suggest' })).toBeNull();
  });

  it("changes a product type's rules from the rules table, sending only those that differ", async () => {
    const gateway = renderSheet();
    fireEvent.click(screen.getByRole('button', { name: 'Suggest rule changes' }));
    const form = within(await screen.findByRole('dialog', { name: 'Suggest rule changes for BLD' }));

    expect((await form.findByRole('combobox', { name: 'Wall' }) as HTMLSelectElement).value).toBe('never');
    fireEvent.change(form.getByRole('combobox', { name: 'Wall' }), { target: { value: 'applies' } });
    fireEvent.click(form.getByRole('button', { name: 'Suggest' }));

    await waitFor(() =>
      expect(gateway.suggest).toHaveBeenCalledWith({ slot: 'productType', code: 'BLD', proposal: { kind: 'rules', rules: { wall: 'applies' } } }),
    );
  });

  it('adds a product type with a rule for every field, copied from the one chosen', async () => {
    const gateway = renderSheet();
    fireEvent.click(list('Product type').getByRole('button', { name: 'Suggest an option for Product type' }));
    const form = within(await screen.findByRole('dialog', { name: 'Suggest an option for Product type' }));

    expect((form.getByRole('combobox', { name: 'Coating' }) as HTMLSelectElement).value).toBe('applies');
    fireEvent.change(form.getByRole('combobox', { name: 'Copy the rules from' }), { target: { value: 'BWL' } });
    expect((form.getByRole('combobox', { name: 'Coating' }) as HTMLSelectElement).value).toBe('never');
    fireEvent.change(form.getByRole('combobox', { name: 'Coating' }), { target: { value: 'paper_only' } });
    fireEvent.change(form.getByLabelText('Code'), { target: { value: 'TRZ' } });
    fireEvent.change(form.getByLabelText('Wording'), { target: { value: 'Tray, invented' } });
    fireEvent.click(form.getByRole('button', { name: 'Suggest' }));

    await waitFor(() =>
      expect(gateway.suggest).toHaveBeenCalledWith({
        slot: 'productType',
        code: 'TRZ',
        proposal: { kind: 'add', meaning: 'Tray, invented', searchWords: [], rules: { coating: 'paper_only', wall: 'applies' } },
      }),
    );
  });
});
