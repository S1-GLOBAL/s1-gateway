import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { AppError } from '@/shared/application/app-error';
import type { SuggestionsGateway } from '../../application/suggestions-gateway';
import { SuggestionsGatewayProvider } from '../../application/suggestions-gateway-context';
import type { AtlasDictionary } from '../../domain/atlas';
import type { Suggestion } from '../../domain/suggestion';
import { DictionarySheet } from './DictionarySheet';

/* Invented people and options only (constraints §6). Each option's key is its number (ADR 0033). */
const ADA = { id: 'ada', fullName: 'Ada Invented' };
const BEN = { id: 'ben', fullName: 'Ben Invented' };

const DICTIONARY: AtlasDictionary = {
  release: 'S2 0.1.0',
  approvedOn: '2026-10-19',
  slots: [
    { key: 'productType', name: 'Product type', values: [{ code: '1', meaning: 'Bowl lid', number: 1, broader: null, searchWords: [] }, { code: '3', meaning: 'Bowl', number: 3, broader: null, searchWords: [] }] },
    {
      key: 'material',
      name: 'Material',
      values: [
        { code: '3', meaning: 'Polymer, PP', number: 3, broader: '11', searchWords: [] },
        { code: '4', meaning: 'Polymer, PS', number: 4, broader: '11', searchWords: ['styrene foam', 'invented foam'] },
        { code: '11', meaning: 'Polymer, grade not known', number: 11, broader: null, searchWords: [] },
      ],
    },
    { key: 'shape', name: 'Shape', values: [{ code: '1', meaning: 'Round', number: 1, broader: null, searchWords: [] }, { code: '2', meaning: 'Square', number: 2, broader: null, searchWords: [] }] },
  ],
  rules: [
    { productType: '1', slot: 'coating', rule: 'applies' },
    { productType: '1', slot: 'wall', rule: 'never' },
    { productType: '3', slot: 'coating', rule: 'never' },
    { productType: '3', slot: 'wall', rule: 'applies' },
  ],
  change: null,
};

/** An approved suggestion, the shape the fake answers a new one from. */
const APPROVED_WORDS: Suggestion = {
  id: 'd1',
  kind: 'edit',
  slot: 'material',
  code: '4',
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

  it("adds an option, asking for no code, with search words, and says it was sent in #95's words", async () => {
    const gateway = renderSheet();
    fireEvent.click(list('Material').getByRole('button', { name: 'Suggest an option for Material' }));
    const form = within(await screen.findByRole('dialog', { name: 'Suggest an option for Material' }));

    expect(form.getByText('It is numbered when an admin approves it: the next number in this list.')).toBeTruthy();
    expect(form.queryByLabelText('Code')).toBeNull();
    expect(form.getByText('One per line. Words people paste that mean this, like “sugarcane fibre”.')).toBeTruthy();
    fireEvent.change(form.getByLabelText('Wording'), { target: { value: 'Polymer, invented' } });
    fireEvent.change(form.getByLabelText('Search words'), { target: { value: 'invented polymer\ncane pulp' } });
    fireEvent.click(form.getByRole('button', { name: 'Suggest' }));

    expect(await screen.findByText('Suggested. An admin will review it.')).toBeTruthy();
    expect(gateway.suggest).toHaveBeenCalledWith({
      slot: 'material',
      code: '',
      proposal: { kind: 'add', meaning: 'Polymer, invented', searchWords: ['invented polymer', 'cane pulp'], rules: null, broader: null },
    });
  });

  it('adds a material as a grade of another, chosen from every material as a code writes it', async () => {
    const gateway = renderSheet();
    fireEvent.click(list('Material').getByRole('button', { name: 'Suggest an option for Material' }));
    const form = within(await screen.findByRole('dialog', { name: 'Suggest an option for Material' }));

    const grade = form.getByRole('combobox', { name: 'A grade of' });
    expect(within(grade).getAllByRole('option').map((option) => option.textContent)).toEqual([
      'None',
      'B3 — Polymer, PP',
      'B4 — Polymer, PS',
      'B11 — Polymer, grade not known',
    ]);
    expect(form.getByText('The broader material, if it is one kind of it: recycled kraft is a grade of kraft.')).toBeTruthy();
    fireEvent.change(grade, { target: { value: '11' } });
    fireEvent.change(form.getByLabelText('Wording'), { target: { value: 'Polymer, invented' } });
    fireEvent.click(form.getByRole('button', { name: 'Suggest' }));

    await waitFor(() =>
      expect(gateway.suggest).toHaveBeenCalledWith({
        slot: 'material',
        code: '',
        proposal: { kind: 'add', meaning: 'Polymer, invented', searchWords: [], rules: null, broader: '11' },
      }),
    );
  });

  it('asks what a new material is a grade of only for Material', async () => {
    renderSheet();
    fireEvent.click(list('Product type').getByRole('button', { name: 'Suggest an option for Product type' }));
    const form = within(await screen.findByRole('dialog', { name: 'Suggest an option for Product type' }));
    expect(form.queryByRole('combobox', { name: 'A grade of' })).toBeNull();
  });

  it("shows each of the server's problems beside its field, and one about the number above the buttons", async () => {
    const fields = {
      code: ['An option is known by its number, given when it is approved. It never changes.'],
      searchWords: ['“styrene foam” already finds B4 (Polymer, PS).'],
    };
    renderSheet(gatewayWith({ suggest: async () => Promise.reject(new AppError('VALIDATION_FAILED', 'The suggestion is not valid.', fields)) }));
    fireEvent.click(list('Material').getByRole('button', { name: 'Suggest an option for Material' }));
    const form = within(await screen.findByRole('dialog', { name: 'Suggest an option for Material' }));
    fireEvent.click(form.getByRole('button', { name: 'Suggest' }));

    expect(await form.findByText('“styrene foam” already finds B4 (Polymer, PS).')).toBeTruthy();
    expect(form.getByLabelText('Search words').getAttribute('aria-invalid')).toBe('true');
    expect(form.getByRole('alert').textContent).toBe('An option is known by its number, given when it is approved. It never changes.');
  });

  it("edits an option's wording and search words from what they are today, never its number", async () => {
    const gateway = renderSheet(gatewayWith({ usage: async () => 3 }));
    const form = await suggestFor('Material', 'Polymer, PS', 'Suggest edit', 'Suggest an edit to B4');

    expect(await form.findByText('Used by 3 saved Spec IDs.')).toBeTruthy();
    expect(form.queryByLabelText('Code')).toBeNull();
    expect((form.getByLabelText('Wording') as HTMLInputElement).value).toBe('Polymer, PS');
    expect((form.getByLabelText('Search words') as HTMLTextAreaElement).value).toBe('styrene foam\ninvented foam');

    fireEvent.change(form.getByLabelText('Wording'), { target: { value: 'Polymer, PS (polystyrene)' } });
    // An option keeps its number, so no saved Spec ID changes (ADR 0033).
    expect(form.getByText('Used by 3 saved Spec IDs.')).toBeTruthy();
    fireEvent.click(form.getByRole('button', { name: 'Suggest' }));

    await waitFor(() =>
      expect(gateway.suggest).toHaveBeenCalledWith({
        slot: 'material',
        code: '4',
        proposal: { kind: 'edit', newCode: null, meaning: 'Polymer, PS (polystyrene)', searchWords: null },
      }),
    );
  });

  it("waits for the option's use before the form shows its fields", async () => {
    renderSheet(gatewayWith({ usage: pending }));
    const form = await suggestFor('Material', 'Polymer, PS', 'Suggest delete', 'Suggest deleting B4');

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
    const form = await suggestFor('Material', 'Polymer, PS', 'Suggest delete', 'Suggest deleting B4');

    expect(await form.findByText('Cannot reach the server. Check your connection and try again.')).toBeTruthy();
    fail = false;
    fireEvent.click(form.getByRole('button', { name: 'Try again' }));
    expect(await form.findByRole('button', { name: 'Suggest' })).toBeTruthy();
  });

  it('deletes an option in use, asking what its Spec IDs become, with Not known (Y)', async () => {
    const gateway = renderSheet(gatewayWith({ usage: async () => 2 }));
    const form = await suggestFor('Material', 'Polymer, PS', 'Suggest delete', 'Suggest deleting B4');

    const becomes = await form.findByRole('combobox', { name: 'What should those Spec IDs become?' });
    expect(within(becomes).getAllByRole('option').map((option) => option.textContent)).toEqual([
      'Choose one',
      'B3 — Polymer, PP',
      'B11 — Polymer, grade not known',
      'Not known (Y)',
    ]);
    expect(form.getByText('Used by 2 saved Spec IDs. If approved, they change too.')).toBeTruthy();
    fireEvent.change(becomes, { target: { value: 'Y' } });
    fireEvent.click(form.getByRole('button', { name: 'Suggest' }));

    await waitFor(() =>
      expect(gateway.suggest).toHaveBeenCalledWith({ slot: 'material', code: '4', proposal: { kind: 'delete', replacement: 'Y' } }),
    );
  });

  it("deletes a product type in use only into another product type, in #95's words", async () => {
    renderSheet(gatewayWith({ usage: async () => 1 }));
    const form = await suggestFor('Product type', 'Bowl lid', 'Suggest delete', 'Suggest deleting A1');

    const becomes = await form.findByRole('combobox', { name: 'What should those Spec IDs become?' });
    expect(within(becomes).getAllByRole('option').map((option) => option.textContent)).toEqual(['Choose one', 'A3 — Bowl']);
    expect(form.getByText("Pick the product type they become. Product type can't be not known.")).toBeTruthy();
  });

  it("lets Round be reworded but does not offer to delete it, in #95's words", async () => {
    renderSheet();
    const lock = "Round is how Atlas knows a shape is round, so it can't be deleted.";

    const editing = await suggestFor('Shape', 'Round', 'Suggest edit', 'Suggest an edit to E1');
    expect((await editing.findByLabelText('Wording') as HTMLInputElement).disabled).toBe(false);
    expect(editing.queryByText(lock)).toBeNull();
    fireEvent.click(editing.getByRole('button', { name: 'Cancel' }));

    const deleting = await suggestFor('Shape', 'Round', 'Suggest delete', 'Suggest deleting E1');
    expect(await deleting.findByText(lock)).toBeTruthy();
    expect(deleting.queryByRole('button', { name: 'Suggest' })).toBeNull();
  });

  it("changes a product type's rules from the rules table, sending only those that differ", async () => {
    const gateway = renderSheet();
    fireEvent.click(screen.getByRole('button', { name: 'Suggest rule changes' }));
    const form = within(await screen.findByRole('dialog', { name: 'Suggest rule changes for A1' }));

    expect((await form.findByRole('combobox', { name: 'Wall' }) as HTMLSelectElement).value).toBe('never');
    fireEvent.change(form.getByRole('combobox', { name: 'Wall' }), { target: { value: 'applies' } });
    fireEvent.click(form.getByRole('button', { name: 'Suggest' }));

    await waitFor(() =>
      expect(gateway.suggest).toHaveBeenCalledWith({ slot: 'productType', code: '1', proposal: { kind: 'rules', rules: { wall: 'applies' } } }),
    );
  });

  it('adds a product type with a rule for every field, copied from the one chosen', async () => {
    const gateway = renderSheet();
    fireEvent.click(list('Product type').getByRole('button', { name: 'Suggest an option for Product type' }));
    const form = within(await screen.findByRole('dialog', { name: 'Suggest an option for Product type' }));

    expect((form.getByRole('combobox', { name: 'Coating' }) as HTMLSelectElement).value).toBe('applies');
    fireEvent.change(form.getByRole('combobox', { name: 'Copy the rules from' }), { target: { value: '3' } });
    expect((form.getByRole('combobox', { name: 'Coating' }) as HTMLSelectElement).value).toBe('never');
    fireEvent.change(form.getByRole('combobox', { name: 'Coating' }), { target: { value: 'paper_only' } });
    fireEvent.change(form.getByLabelText('Wording'), { target: { value: 'Tray, invented' } });
    fireEvent.click(form.getByRole('button', { name: 'Suggest' }));

    await waitFor(() =>
      expect(gateway.suggest).toHaveBeenCalledWith({
        slot: 'productType',
        code: '',
        proposal: { kind: 'add', meaning: 'Tray, invented', searchWords: [], rules: { coating: 'paper_only', wall: 'applies' } },
      }),
    );
  });
});
