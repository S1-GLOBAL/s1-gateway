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

/* Invented people and options only (constraints §6). */
const ADA = { id: 'ada', fullName: 'Ada Invented' };
const BEN = { id: 'ben', fullName: 'Ben Invented' };

const DICTIONARY: AtlasDictionary = {
  release: 'S2 0.1.0',
  approvedOn: '2026-10-19',
  slots: [{ key: 'material', name: 'Material', values: [{ code: 'APS', meaning: 'Polymer, PS' }, { code: 'APP', meaning: 'Polymer, PP' }] }],
  rules: [],
};

type SuggestionOf = Awaited<ReturnType<SuggestionsGateway['list']>>[number];
type DetailOf = Awaited<ReturnType<SuggestionsGateway['get']>>;

const RENAME: SuggestionOf = {
  id: 's1',
  kind: 'edit',
  slot: 'material',
  code: 'APS',
  proposal: { kind: 'edit', newCode: 'APZ', meaning: null, searchWords: null },
  state: 'waiting',
  version: 2,
  suggestedBy: ADA,
  suggestedAt: new Date('2026-10-27T08:00:00.000Z'),
  decidedBy: null,
  decidedAt: null,
  reason: null,
  changeNumber: null,
};

const RENAME_DETAIL: DetailOf = {
  ...RENAME,
  events: [
    { kind: 'suggested', by: ADA, at: new Date('2026-10-27T08:00:00.000Z'), proposalBefore: null, proposalAfter: RENAME.proposal, reason: null },
    {
      kind: 'edited',
      by: ADA,
      at: new Date('2026-10-27T09:00:00.000Z'),
      proposalBefore: { kind: 'edit', newCode: 'APY', meaning: null, searchWords: null },
      proposalAfter: RENAME.proposal,
      reason: null,
    },
  ],
  usage: 2,
  rewrites: [
    { id: 'x1', name: 'Lid 90', codeBefore: 'BLD.APS.Y.CL.RD.DM', codeAfter: 'BLD.APZ.Y.CL.RD.DM' },
    { id: 'x2', name: 'Lid 95', codeBefore: 'BLD.APS.Y.WH.RD.DM', codeAfter: 'BLD.APZ.Y.WH.RD.DM' },
  ],
  problem: null,
};

const pending = () => new Promise<never>(() => undefined);

function suggestionsWith(overrides: Partial<SuggestionsGateway> = {}): SuggestionsGateway {
  return {
    list: async (state) => (state === 'waiting' ? [RENAME] : []),
    get: async () => RENAME_DETAIL,
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
    list: async (state) => (state === 'waiting' && !acted ? [RENAME] : []),
    get: async () => {
      if (acted) await new Promise((resolve) => setTimeout(resolve, 50));
      return RENAME_DETAIL;
    },
    approve: act({ suggestion: { ...RENAME, state: 'approved' as const, decidedBy: BEN, changeNumber: 4 }, changeNumber: 4, specIdsRewritten: 3 }),
    reject: act({ ...RENAME, state: 'rejected' as const, decidedBy: BEN, reason: 'We have APP.' }),
    withdraw: act({ ...RENAME, state: 'withdrawn' as const }),
  });
}

const atlasGateway = { dictionary: async () => DICTIONARY } as unknown as AtlasGateway;

function renderPage(viewer: { id: string; fullName: string; isAdmin: boolean }, suggestions: SuggestionsGateway) {
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <AccountsGatewayProvider gateway={fakeAccountsGateway({ me: async () => account({ ...viewer }) })}>
        <AtlasGatewayProvider gateway={atlasGateway}>
          <SuggestionsGatewayProvider gateway={suggestions}>
            <MemoryRouter>
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

  it("says so when no suggestion waits, in #95's words", async () => {
    renderPage(asAdmin, suggestionsWith({ list: async () => [] }));
    expect(await screen.findByText('No suggestions waiting.')).toBeTruthy();
  });

  it('shows a waiting suggestion in full: before and after, its use, and the codes it would change', async () => {
    renderPage(asAdmin, suggestionsWith());
    const rename = await card('Change APS in Material');
    expect(rename.getByText('Used by 2 saved Spec IDs. If approved, they change too.')).toBeTruthy();
    expect(rename.getByText('APZ')).toBeTruthy();
    expect(rename.getByText('BLD.APZ.Y.CL.RD.DM')).toBeTruthy();
    expect(rename.getByText(/Suggested by Ada Invented/)).toBeTruthy();
  });

  it('opens the trail: who suggested it, and what each edit changed', async () => {
    renderPage(asAdmin, suggestionsWith());
    const rename = await card('Change APS in Material');
    fireEvent.click(rename.getByRole('button', { name: 'Show trail' }));
    const trail = within(rename.getByRole('list', { name: 'Trail' }));
    expect(trail.getByText('Suggested')).toBeTruthy();
    expect(trail.getByText('Edited')).toBeTruthy();
    expect(trail.getByText('APY')).toBeTruthy();
  });

  it('gives the suggester Withdraw and "Waiting for an admin", and no Approve', async () => {
    renderPage(asStaffSuggester, suggestionsWith());
    const rename = await card('Change APS in Material');
    expect(rename.getByRole('button', { name: 'Withdraw' })).toBeTruthy();
    expect(rename.getByText('Waiting for an admin')).toBeTruthy();
    expect(rename.queryByRole('button', { name: 'Approve' })).toBeNull();
    expect(rename.queryByRole('button', { name: 'Reject' })).toBeNull();
  });

  it('gives another admin Approve and Reject, and no Withdraw', async () => {
    renderPage(asAdmin, suggestionsWith());
    const rename = await card('Change APS in Material');
    expect(rename.getByRole('button', { name: 'Approve' })).toBeTruthy();
    expect(rename.getByRole('button', { name: 'Reject' })).toBeTruthy();
    expect(rename.queryByRole('button', { name: 'Withdraw' })).toBeNull();
  });

  it('never gives an admin Approve on their own suggestion', async () => {
    renderPage(asAdminSuggester, suggestionsWith());
    const rename = await card('Change APS in Material');
    expect(rename.queryByRole('button', { name: 'Approve' })).toBeNull();
    expect(rename.getByRole('button', { name: 'Withdraw' })).toBeTruthy();
  });

  it("approves the version read, and says the change is live in #95's words", async () => {
    const approve = vi.fn(async () => ({ suggestion: { ...RENAME, state: 'approved' as const }, changeNumber: 4, specIdsRewritten: 3 }));
    renderPage(asAdmin, suggestionsWith({ approve }));
    fireEvent.click((await card('Change APS in Material')).getByRole('button', { name: 'Approve' }));
    expect(await screen.findByText('Change #4 is live. 3 saved Spec IDs were updated.')).toBeTruthy();
    expect(approve).toHaveBeenCalledWith('s1', 2);
  });

  it("shows a refused approval's own message", async () => {
    const message = 'Approving this would make saved Spec IDs identical: A and B. Edit or reject the suggestion.';
    renderPage(asAdmin, suggestionsWith({ approve: async () => Promise.reject(new AppError('SPEC_IDS_WOULD_CLASH', message)) }));
    fireEvent.click((await card('Change APS in Material')).getByRole('button', { name: 'Approve' }));
    expect((await screen.findByRole('alert')).textContent).toBe(message);
  });

  it('says why approving would be refused, and holds Approve back', async () => {
    const problem = 'The dictionary changed since this was suggested: APZ is already Polymer, invented. The suggester can edit it, or you can reject it.';
    renderPage(asAdmin, suggestionsWith({ get: async () => ({ ...RENAME_DETAIL, rewrites: null, problem }) }));
    const rename = await card('Change APS in Material');
    expect(rename.getByText(problem)).toBeTruthy();
    expect((rename.getByRole('button', { name: 'Approve' }) as HTMLButtonElement).disabled).toBe(true);
  });

  it("answers a rejection without a reason under the field, in #95's words", async () => {
    const reject = vi.fn(async () =>
      Promise.reject(new AppError('VALIDATION_FAILED', 'The suggestion is not valid.', { reason: ['Say why, so Ada Invented knows what to change.'] })),
    );
    renderPage(asAdmin, suggestionsWith({ reject }));
    fireEvent.click((await card('Change APS in Material')).getByRole('button', { name: 'Reject' }));
    const sheet = within(await screen.findByRole('dialog', { name: 'Reject APS' }));
    fireEvent.click(sheet.getByRole('button', { name: 'Reject' }));
    expect(await sheet.findByText('Say why, so Ada Invented knows what to change.')).toBeTruthy();
    expect(reject).toHaveBeenCalledWith('s1', '');
  });

  it('rejects with the reason typed, and says the suggester sees it', async () => {
    const reject = vi.fn(async () => ({ ...RENAME, state: 'rejected' as const, decidedBy: BEN, reason: 'We have APP.' }));
    renderPage(asAdmin, suggestionsWith({ reject }));
    fireEvent.click((await card('Change APS in Material')).getByRole('button', { name: 'Reject' }));
    const sheet = within(await screen.findByRole('dialog', { name: 'Reject APS' }));
    fireEvent.change(sheet.getByLabelText('Reason'), { target: { value: 'We have APP.' } });
    fireEvent.click(sheet.getByRole('button', { name: 'Reject' }));
    expect(await screen.findByText('Rejected. Ada Invented sees your reason.')).toBeTruthy();
    expect(reject).toHaveBeenCalledWith('s1', 'We have APP.');
  });

  it('withdraws for the suggester', async () => {
    const withdraw = vi.fn(async () => ({ ...RENAME, state: 'withdrawn' as const }));
    renderPage(asStaffSuggester, suggestionsWith({ withdraw }));
    fireEvent.click((await card('Change APS in Material')).getByRole('button', { name: 'Withdraw' }));
    expect(await screen.findByText('Withdrawn.')).toBeTruthy();
    expect(withdraw).toHaveBeenCalledWith('s1');
  });

  it('says the change is live, though the card has already left the list', async () => {
    renderPage(asAdmin, leavingTheList());
    fireEvent.click((await card('Change APS in Material')).getByRole('button', { name: 'Approve' }));
    expect(await screen.findByText('No suggestions waiting.')).toBeTruthy();
    expect(await screen.findByText('Change #4 is live. 3 saved Spec IDs were updated.')).toBeTruthy();
  });

  it('says a rejection was sent, though the card has already left the list', async () => {
    renderPage(asAdmin, leavingTheList());
    fireEvent.click((await card('Change APS in Material')).getByRole('button', { name: 'Reject' }));
    const sheet = within(await screen.findByRole('dialog', { name: 'Reject APS' }));
    fireEvent.change(sheet.getByLabelText('Reason'), { target: { value: 'We have APP.' } });
    fireEvent.click(sheet.getByRole('button', { name: 'Reject' }));
    expect(await screen.findByText('No suggestions waiting.')).toBeTruthy();
    expect(await screen.findByText('Rejected. Ada Invented sees your reason.')).toBeTruthy();
  });

  it('says a withdrawal was made, though the card has already left the list', async () => {
    renderPage(asStaffSuggester, leavingTheList());
    fireEvent.click((await card('Change APS in Material')).getByRole('button', { name: 'Withdraw' }));
    expect(await screen.findByText('No suggestions waiting.')).toBeTruthy();
    expect(await screen.findByText('Withdrawn.')).toBeTruthy();
  });

  it("lists each decision in the history in #95's words", async () => {
    const decided: SuggestionOf[] = [
      { ...RENAME, id: 'd1', state: 'approved', decidedBy: BEN, changeNumber: 4 },
      { ...RENAME, id: 'd2', code: 'APP', state: 'rejected', decidedBy: BEN, reason: 'We have APP.' },
      { ...RENAME, id: 'd3', code: 'APQ', state: 'withdrawn' },
    ];
    renderPage(asStaffSuggester, suggestionsWith({ list: async (state) => (state === 'decided' ? decided : []) }));
    fireEvent.click(await screen.findByRole('radio', { name: 'History' }));
    expect(await screen.findByText('Approved as change #4 by Ben Invented')).toBeTruthy();
    expect(screen.getByText('Rejected by Ben Invented: We have APP.')).toBeTruthy();
    expect((await card('Change APQ in Material')).getAllByText('Withdrawn').length).toBeGreaterThan(0);
  });

  it("says so when nothing was decided yet, in #95's words", async () => {
    renderPage(asStaffSuggester, suggestionsWith({ list: async () => [] }));
    fireEvent.click(await screen.findByRole('radio', { name: 'History' }));
    expect(await screen.findByText('No dictionary changes yet.')).toBeTruthy();
    expect(screen.getByText('Approved changes appear here.')).toBeTruthy();
  });

  it("loads a decided suggestion's trail when it is opened", async () => {
    const get = vi.fn(async () => ({ ...RENAME_DETAIL, state: 'approved' as const, decidedBy: BEN, changeNumber: 4, rewrites: null }));
    const decided = [{ ...RENAME, state: 'approved' as const, decidedBy: BEN, changeNumber: 4 }];
    renderPage(asStaffSuggester, suggestionsWith({ list: async (state) => (state === 'decided' ? decided : []), get }));
    fireEvent.click(await screen.findByRole('radio', { name: 'History' }));
    const rename = await card('Change APS in Material');
    expect(get).not.toHaveBeenCalled();
    fireEvent.click(rename.getByRole('button', { name: 'Show trail' }));
    await waitFor(() => expect(rename.getByRole('list', { name: 'Trail' })).toBeTruthy());
    expect(get).toHaveBeenCalledWith('s1');
  });

  it('offers Try again when the suggestions cannot load', async () => {
    renderPage(asAdmin, suggestionsWith({ list: async () => Promise.reject(new AppError('NETWORK', 'Cannot reach the server.')) }));
    expect(await screen.findByRole('button', { name: 'Try again' })).toBeTruthy();
  });
});
