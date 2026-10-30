import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { RouteBoundary } from '@/app/shell/RouteBoundary';
import { AccountsGatewayProvider } from '@/features/accounts';
import {
  AtlasGatewayProvider,
  SuggestionsGatewayProvider,
  type AtlasDictionary,
  type AtlasGateway,
  type SuggestionsGateway,
} from '@/features/atlas';
import { AppError } from '@/shared/application/app-error';
import { account, fakeAccountsGateway } from '@/test/fake-accounts-gateway';
import { DictionaryChangesPage } from './DictionaryChangesPage';
import { DictionaryChangesPageSkeleton } from './DictionaryChangesPageSkeleton';

/* Invented people and options only (constraints §6). Each option's key is its number (ADR 0033). */
const ADA = { id: 'ada', fullName: 'Ada Invented' };
const BEN = { id: 'ben', fullName: 'Ben Invented' };

const DICTIONARY: AtlasDictionary = {
  release: 'S2 0.1.0',
  approvedOn: '2026-10-19',
  change: null,
  slots: [{ key: 'material', name: 'Material', values: [{ code: '3', meaning: 'Polymer, PP', number: 3, broader: null, searchWords: [] }, { code: '4', meaning: 'Polymer, PS', number: 4, broader: null, searchWords: [] }] }],
  rules: [],
};

type SuggestionOf = Awaited<ReturnType<SuggestionsGateway['list']>>[number];
type DetailOf = Awaited<ReturnType<SuggestionsGateway['get']>>;

/** A waiting deletion of B4, its Spec IDs to become B3: the kind of change that rewrites saved Spec IDs. */
const DELETION: SuggestionOf = {
  id: 's1',
  kind: 'delete',
  slot: 'material',
  code: '4',
  proposal: { kind: 'delete', replacement: '3' },
  state: 'waiting',
  version: 2,
  suggestedBy: ADA,
  suggestedAt: new Date('2026-10-27T08:00:00.000Z'),
  decidedBy: null,
  decidedAt: null,
  reason: null,
  changeNumber: null,
};

const DELETION_DETAIL: DetailOf = {
  ...DELETION,
  events: [
    { kind: 'suggested', by: ADA, at: new Date('2026-10-27T08:00:00.000Z'), proposalBefore: null, proposalAfter: DELETION.proposal, reason: null },
    {
      kind: 'edited',
      by: ADA,
      at: new Date('2026-10-27T09:00:00.000Z'),
      proposalBefore: { kind: 'delete', replacement: 'Y' },
      proposalAfter: DELETION.proposal,
      reason: null,
    },
  ],
  usage: 2,
  rewrites: [
    { id: 'x1', name: 'Lid 90', codeBefore: 'A1B4D1E1F1-H90', codeAfter: 'A1B3D1E1F1-H90' },
    { id: 'x2', name: 'Lid 95', codeBefore: 'A1B4D3E1F1-H95', codeAfter: 'A1B3D3E1F1-H95' },
  ],
  problem: null,
};

const pending = () => new Promise<never>(() => undefined);

function suggestionsWith(overrides: Partial<SuggestionsGateway> = {}): SuggestionsGateway {
  return {
    suggest: pending,
    edit: pending,
    usage: async () => 0,
    list: async (state) => (state === 'waiting' ? [DELETION] : []),
    get: async () => DELETION_DETAIL,
    waitingCount: async () => 1,
    approve: pending,
    reject: pending,
    withdraw: pending,
    ...overrides,
  };
}

/**
 * As the server answers: once acted on, the suggestion no longer waits, so its
 * card leaves the list, while the slower full suggestion is still being asked
 * for again.
 */
function leavingTheList(): SuggestionsGateway {
  let acted = false;
  const act = <T,>(answer: T) => async () => {
    acted = true;
    return answer;
  };
  return suggestionsWith({
    list: async (state) => (state === 'waiting' && !acted ? [DELETION] : []),
    get: async () => {
      if (acted) await new Promise((resolve) => setTimeout(resolve, 50));
      return DELETION_DETAIL;
    },
    approve: act({ suggestion: { ...DELETION, state: 'approved' as const, decidedBy: BEN, changeNumber: 4 }, changeNumber: 4, specIdsRewritten: 3 }),
    reject: act({ ...DELETION, state: 'rejected' as const, decidedBy: BEN, reason: 'We still need it.' }),
    withdraw: act({ ...DELETION, state: 'withdrawn' as const }),
  });
}

const atlasGateway = { dictionary: async () => DICTIONARY } as unknown as AtlasGateway;

function renderPage(viewer: { id: string; fullName: string; isAdmin: boolean }, suggestions: SuggestionsGateway, path = '/dictionary/changes') {
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <AccountsGatewayProvider gateway={fakeAccountsGateway({ me: async () => account({ ...viewer }) })}>
        <AtlasGatewayProvider gateway={atlasGateway}>
          <SuggestionsGatewayProvider gateway={suggestions}>
            <MemoryRouter initialEntries={[path]}>
              <RouteBoundary skeleton={<DictionaryChangesPageSkeleton />}>
                <DictionaryChangesPage />
              </RouteBoundary>
            </MemoryRouter>
          </SuggestionsGatewayProvider>
        </AtlasGatewayProvider>
      </AccountsGatewayProvider>
    </QueryClientProvider>,
  );
}

const asStaffSuggester = { ...ADA, isAdmin: false };
const asAdmin = { ...BEN, isAdmin: true };
const asAdminSuggester = { ...ADA, isAdmin: true };

async function card(title: string) {
  return within(await screen.findByRole('region', { name: title }));
}

describe('DictionaryChangesPage', () => {
  it('shows its skeleton while the page loads', () => {
    renderPage(asAdmin, suggestionsWith({ list: pending }));
    expect(screen.getByRole('status', { name: /Loading/ })).toBeTruthy();
  });

  it('names the page Dictionary Changes', async () => {
    renderPage(asAdmin, suggestionsWith({ list: async () => [] }));
    expect(await screen.findByRole('heading', { level: 1, name: 'Dictionary Changes' })).toBeTruthy();
  });

  it("says so when no suggestion waits, in #95's words", async () => {
    renderPage(asAdmin, suggestionsWith({ list: async () => [] }));
    expect(await screen.findByText('No suggestions waiting.')).toBeTruthy();
  });

  it('shows a waiting suggestion in full: before and after, its use, and the codes it would change', async () => {
    renderPage(asAdmin, suggestionsWith());
    const deletion = await card('Delete B4 from Material');
    expect(deletion.getByText('Used by 2 saved Spec IDs. If approved, they change too.')).toBeTruthy();
    expect(deletion.getByText('B3 (Polymer, PP)')).toBeTruthy();
    expect(deletion.getByText('A1B3D1E1F1-H90')).toBeTruthy();
    expect(deletion.getByText(/Suggested by Ada Invented/)).toBeTruthy();
  });

  it('opens the trail: who suggested it, and what each edit changed', async () => {
    renderPage(asAdmin, suggestionsWith());
    const deletion = await card('Delete B4 from Material');
    fireEvent.click(deletion.getByRole('button', { name: 'Show trail' }));
    const trail = within(deletion.getByRole('list', { name: 'Trail' }));
    expect(trail.getByText('Suggested')).toBeTruthy();
    expect(trail.getByText('Edited')).toBeTruthy();
    expect(trail.getByText('Y')).toBeTruthy();
  });

  it('gives the suggester Withdraw and "Waiting for an admin", and no Approve', async () => {
    renderPage(asStaffSuggester, suggestionsWith());
    const deletion = await card('Delete B4 from Material');
    expect(deletion.getByRole('button', { name: 'Withdraw' })).toBeTruthy();
    expect(deletion.getByText('Waiting for an admin')).toBeTruthy();
    expect(deletion.queryByRole('button', { name: 'Approve' })).toBeNull();
    expect(deletion.queryByRole('button', { name: 'Reject' })).toBeNull();
  });

  it('gives another admin Approve and Reject, and no Withdraw', async () => {
    renderPage(asAdmin, suggestionsWith());
    const deletion = await card('Delete B4 from Material');
    expect(deletion.getByRole('button', { name: 'Approve' })).toBeTruthy();
    expect(deletion.getByRole('button', { name: 'Reject' })).toBeTruthy();
    expect(deletion.queryByRole('button', { name: 'Withdraw' })).toBeNull();
  });

  it('never gives an admin Approve on their own suggestion', async () => {
    renderPage(asAdminSuggester, suggestionsWith());
    const deletion = await card('Delete B4 from Material');
    expect(deletion.queryByRole('button', { name: 'Approve' })).toBeNull();
    expect(deletion.getByRole('button', { name: 'Withdraw' })).toBeTruthy();
  });

  it("approves the version read, and says the change is live in #95's words", async () => {
    const approve = vi.fn(async () => ({ suggestion: { ...DELETION, state: 'approved' as const }, changeNumber: 4, specIdsRewritten: 3 }));
    renderPage(asAdmin, suggestionsWith({ approve }));
    fireEvent.click((await card('Delete B4 from Material')).getByRole('button', { name: 'Approve' }));
    expect(await screen.findByText('Change #4 is live. 3 saved Spec IDs were updated.')).toBeTruthy();
    expect(approve).toHaveBeenCalledWith('s1', 2);
  });

  it("shows a refused approval's own message", async () => {
    const message = 'Approving this would make saved Spec IDs identical: A and B. Edit or reject the suggestion.';
    renderPage(asAdmin, suggestionsWith({ approve: async () => Promise.reject(new AppError('SPEC_IDS_WOULD_CLASH', message)) }));
    fireEvent.click((await card('Delete B4 from Material')).getByRole('button', { name: 'Approve' }));
    expect((await screen.findByRole('alert')).textContent).toBe(message);
  });

  it('says why approving would be refused, and holds Approve back', async () => {
    const problem = 'The dictionary changed since this was suggested: Material has no option 3. The suggester can edit it, or you can reject it.';
    renderPage(asAdmin, suggestionsWith({ get: async () => ({ ...DELETION_DETAIL, rewrites: null, problem }) }));
    const deletion = await card('Delete B4 from Material');
    expect(deletion.getByText(problem)).toBeTruthy();
    expect((deletion.getByRole('button', { name: 'Approve' }) as HTMLButtonElement).disabled).toBe(true);
  });

  it("answers a rejection without a reason under the field, in #95's words", async () => {
    const reject = vi.fn(async () =>
      Promise.reject(new AppError('VALIDATION_FAILED', 'The suggestion is not valid.', { reason: ['Say why, so Ada Invented knows what to change.'] })),
    );
    renderPage(asAdmin, suggestionsWith({ reject }));
    fireEvent.click((await card('Delete B4 from Material')).getByRole('button', { name: 'Reject' }));
    const sheet = within(await screen.findByRole('dialog', { name: /^Reject / }));
    fireEvent.click(sheet.getByRole('button', { name: 'Reject' }));
    expect(await sheet.findByText('Say why, so Ada Invented knows what to change.')).toBeTruthy();
    expect(reject).toHaveBeenCalledWith('s1', '');
  });

  it('rejects with the reason typed, and says the suggester sees it', async () => {
    const reject = vi.fn(async () => ({ ...DELETION, state: 'rejected' as const, decidedBy: BEN, reason: 'We still need it.' }));
    renderPage(asAdmin, suggestionsWith({ reject }));
    fireEvent.click((await card('Delete B4 from Material')).getByRole('button', { name: 'Reject' }));
    const sheet = within(await screen.findByRole('dialog', { name: /^Reject / }));
    fireEvent.change(sheet.getByLabelText('Reason'), { target: { value: 'We still need it.' } });
    fireEvent.click(sheet.getByRole('button', { name: 'Reject' }));
    expect(await screen.findByText('Rejected. Ada Invented sees your reason.')).toBeTruthy();
    expect(reject).toHaveBeenCalledWith('s1', 'We still need it.');
  });

  it("lets the suggester edit it in the same form, from the version read, and the trail shows the edit's before and after", async () => {
    let edited = false;
    const reworded = { kind: 'delete' as const, replacement: 'Y' };
    const after = { ...DELETION, version: 3, proposal: reworded };
    const edit = vi.fn(async () => {
      edited = true;
      return after;
    });
    renderPage(
      asStaffSuggester,
      suggestionsWith({
        list: async (state) => (state === 'waiting' ? [edited ? after : DELETION] : []),
        get: async () =>
          edited
            ? {
                ...DELETION_DETAIL,
                ...after,
                events: [
                  ...DELETION_DETAIL.events,
                  { kind: 'edited', by: ADA, at: new Date('2026-10-27T10:00:00.000Z'), proposalBefore: DELETION.proposal, proposalAfter: reworded, reason: null },
                ],
              }
            : DELETION_DETAIL,
        edit,
        usage: async () => 2,
      }),
    );

    fireEvent.click((await card('Delete B4 from Material')).getByRole('button', { name: 'Edit' }));
    const form = within(await screen.findByRole('dialog', { name: 'Edit your suggestion' }));
    const becomes = (await form.findByRole('combobox', { name: 'What should those Spec IDs become?' })) as HTMLSelectElement;
    expect(becomes.value).toBe('3');
    fireEvent.change(becomes, { target: { value: 'Y' } });
    fireEvent.click(form.getByRole('button', { name: 'Save edit' }));

    expect(await screen.findByText('Suggested. An admin will review it.')).toBeTruthy();
    expect(edit).toHaveBeenCalledWith('s1', { slot: 'material', code: '4', proposal: reworded, version: 2 });

    const deletion = await card('Delete B4 from Material');
    fireEvent.click(deletion.getByRole('button', { name: 'Show trail' }));
    const trail = within(deletion.getByRole('list', { name: 'Trail' }));
    const lastEdit = within(trail.getAllByRole('listitem').at(-1) as HTMLElement);
    expect(lastEdit.getByText('Edited')).toBeTruthy();
    expect(lastEdit.getByText('3').className).toContain('line-through');
    expect(lastEdit.getByText('Y')).toBeTruthy();
  });

  it('gives no one else Edit', async () => {
    renderPage(asAdmin, suggestionsWith());
    expect((await card('Delete B4 from Material')).queryByRole('button', { name: 'Edit' })).toBeNull();
  });

  it("opens the history on the change a Spec ID's history links to, with its trail", async () => {
    const decided = [{ ...DELETION, state: 'approved' as const, decidedBy: BEN, changeNumber: 4 }];
    renderPage(
      asStaffSuggester,
      suggestionsWith({ list: async (state) => (state === 'decided' ? decided : []), get: async () => ({ ...DELETION_DETAIL, ...decided[0], rewrites: null }) }),
      '/dictionary/changes?change=4',
    );
    const deletion = await card('Delete B4 from Material');
    expect(screen.getByRole('radio', { name: 'History' }).getAttribute('aria-checked')).toBe('true');
    expect(await deletion.findByRole('list', { name: 'Trail' })).toBeTruthy();
  });

  it('withdraws for the suggester', async () => {
    const withdraw = vi.fn(async () => ({ ...DELETION, state: 'withdrawn' as const }));
    renderPage(asStaffSuggester, suggestionsWith({ withdraw }));
    fireEvent.click((await card('Delete B4 from Material')).getByRole('button', { name: 'Withdraw' }));
    expect(await screen.findByText('Withdrawn.')).toBeTruthy();
    expect(withdraw).toHaveBeenCalledWith('s1');
  });

  it('says the change is live, though the card has already left the list', async () => {
    renderPage(asAdmin, leavingTheList());
    fireEvent.click((await card('Delete B4 from Material')).getByRole('button', { name: 'Approve' }));
    expect(await screen.findByText('No suggestions waiting.')).toBeTruthy();
    expect(await screen.findByText('Change #4 is live. 3 saved Spec IDs were updated.')).toBeTruthy();
  });

  it('says a rejection was sent, though the card has already left the list', async () => {
    renderPage(asAdmin, leavingTheList());
    fireEvent.click((await card('Delete B4 from Material')).getByRole('button', { name: 'Reject' }));
    const sheet = within(await screen.findByRole('dialog', { name: /^Reject / }));
    fireEvent.change(sheet.getByLabelText('Reason'), { target: { value: 'We still need it.' } });
    fireEvent.click(sheet.getByRole('button', { name: 'Reject' }));
    expect(await screen.findByText('No suggestions waiting.')).toBeTruthy();
    expect(await screen.findByText('Rejected. Ada Invented sees your reason.')).toBeTruthy();
  });

  it('says a withdrawal was made, though the card has already left the list', async () => {
    renderPage(asStaffSuggester, leavingTheList());
    fireEvent.click((await card('Delete B4 from Material')).getByRole('button', { name: 'Withdraw' }));
    expect(await screen.findByText('No suggestions waiting.')).toBeTruthy();
    expect(await screen.findByText('Withdrawn.')).toBeTruthy();
  });

  it("lists each decision in the history in #95's words", async () => {
    const decided: SuggestionOf[] = [
      { ...DELETION, id: 'd1', state: 'approved', decidedBy: BEN, changeNumber: 4 },
      { ...DELETION, id: 'd2', code: '11', state: 'rejected', decidedBy: BEN, reason: 'We still need it.' },
      { ...DELETION, id: 'd3', code: '3', state: 'withdrawn' },
    ];
    renderPage(asStaffSuggester, suggestionsWith({ list: async (state) => (state === 'decided' ? decided : []) }));
    fireEvent.click(await screen.findByRole('radio', { name: 'History' }));
    expect(await screen.findByText('Approved as change #4 by Ben Invented')).toBeTruthy();
    expect(screen.getByText('Rejected by Ben Invented: We still need it.')).toBeTruthy();
    expect((await card('Delete B3 from Material')).getAllByText('Withdrawn').length).toBeGreaterThan(0);
  });

  it("says so when nothing was decided yet, in #95's words", async () => {
    renderPage(asStaffSuggester, suggestionsWith({ list: async () => [] }));
    fireEvent.click(await screen.findByRole('radio', { name: 'History' }));
    expect(await screen.findByText('No dictionary changes yet.')).toBeTruthy();
    expect(screen.getByText('Approved changes appear here.')).toBeTruthy();
  });

  it("loads a decided suggestion's trail when it is opened", async () => {
    const get = vi.fn(async () => ({ ...DELETION_DETAIL, state: 'approved' as const, decidedBy: BEN, changeNumber: 4, rewrites: null }));
    const decided = [{ ...DELETION, state: 'approved' as const, decidedBy: BEN, changeNumber: 4 }];
    renderPage(asStaffSuggester, suggestionsWith({ list: async (state) => (state === 'decided' ? decided : []), get }));
    fireEvent.click(await screen.findByRole('radio', { name: 'History' }));
    const deletion = await card('Delete B4 from Material');
    expect(get).not.toHaveBeenCalled();
    fireEvent.click(deletion.getByRole('button', { name: 'Show trail' }));
    await waitFor(() => expect(deletion.getByRole('list', { name: 'Trail' })).toBeTruthy());
    expect(get).toHaveBeenCalledWith('s1');
  });

  it('offers Try again when the suggestions cannot load', async () => {
    renderPage(asAdmin, suggestionsWith({ list: async () => Promise.reject(new AppError('NETWORK', 'Cannot reach the server.')) }));
    expect(await screen.findByRole('button', { name: 'Try again' })).toBeTruthy();
  });
});
