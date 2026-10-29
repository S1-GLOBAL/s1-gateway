import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AppError } from '@/shared/application/app-error';
import type { AtlasGateway } from '../../application/atlas-gateway';
import { AtlasGatewayProvider } from '../../application/atlas-gateway-context';
import {
  gatewayWith,
  ILLUSTRATIVE,
  ILLUSTRATIVE_V2,
  lookupFor,
  readCode,
  s1Dictionary,
  savedFor,
  withSlot,
} from '../../application/testing/atlas-fixtures';
import type { AtlasDictionary, SavedSpecId, SlotKey } from '../../domain/atlas';
import { AtlasLibrary, SEARCH_WAIT_MS } from './AtlasLibrary';

const EMPTY = { items: [], page: 1, pageSize: 20, total: 0 };

function pageOf(items: SavedSpecId[], total = items.length, page = 1) {
  return { items, page, pageSize: 20, total };
}
const NOT_FOUND = new AppError('SPEC_ID_NOT_FOUND', 'No saved Spec ID has this code. Check it, or build and save it.');

/** A saved Spec ID as the library answers it: three slots not known. */
function saved(index: number, overrides: Partial<SavedSpecId> = {}): SavedSpecId {
  const id = `00000000-0000-4000-8000-${String(index).padStart(12, '0')}`;
  return { ...savedFor(ILLUSTRATIVE, `Lid ${index}`, { id }), slots: readCode(ILLUSTRATIVE).slots, ...overrides };
}

function renderLibrary(
  overrides: Partial<AtlasGateway> = {},
  dictionary: AtlasDictionary = s1Dictionary,
  untilAsked = false,
) {
  const gateway = gatewayWith({ library: vi.fn(async () => EMPTY), ...overrides });
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: 60_000 } } });
  render(
    <QueryClientProvider client={queryClient}>
      <AtlasGatewayProvider gateway={gateway}>
        <MemoryRouter>
          <AtlasLibrary dictionary={dictionary} timeZone="UTC" untilAsked={untilAsked} />
        </MemoryRouter>
      </AtlasGatewayProvider>
    </QueryClientProvider>,
  );
  return gateway;
}

const search = (text: string) => fireEvent.change(screen.getByLabelText('Search'), { target: { value: text } });

// The library's list comes first; each card holds its own list of stage icons (#73).
const cards = () => within(screen.getAllByRole('list')[0]!).getAllByRole('link');

afterEach(() => {
  vi.useRealTimers();
});

describe('AtlasLibrary, the list', () => {
  it('shows the last page on the first paint, and a jump loads that page in one request', async () => {
    const first = Array.from({ length: 20 }, (_, index) => saved(index + 1));
    const library = vi.fn<AtlasGateway['library']>(async ({ page }) =>
      page === 3 ? pageOf([saved(41)], 41, 3) : pageOf(first, 41, 1),
    );
    renderLibrary({ library });

    await waitFor(() => expect(cards()).toHaveLength(20));
    expect(screen.getByRole('button', { name: 'Page 1' }).getAttribute('aria-current')).toBe('page');
    expect(screen.getByRole('button', { name: 'Page 3' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Page 4' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Previous page' }).hasAttribute('disabled')).toBe(true);

    fireEvent.click(screen.getByRole('button', { name: 'Page 3' }));

    await waitFor(() => expect(cards()).toHaveLength(1));
    expect(screen.getByText('Lid 41')).toBeTruthy();
    expect(screen.queryByText('Lid 1')).toBeNull();
    expect(library).toHaveBeenLastCalledWith({ q: '', productType: '', page: 3 });
    expect(library.mock.calls.map((call) => call[0].page)).toEqual([1, 3]);
    expect(screen.getByRole('button', { name: 'Page 3' }).getAttribute('aria-current')).toBe('page');
    expect(screen.getByRole('button', { name: 'Next page' }).hasAttribute('disabled')).toBe(true);

    fireEvent.click(screen.getByRole('button', { name: 'Page 1' }));

    await waitFor(() => expect(cards()).toHaveLength(20));
    expect(screen.getByText('Lid 1')).toBeTruthy();
    expect(library.mock.calls.map((call) => call[0].page)).toEqual([1, 3]);
  });

  it('keeps Try again when a page fails to load', async () => {
    const first = Array.from({ length: 20 }, (_, index) => saved(index + 1));
    const library = vi
      .fn<AtlasGateway['library']>()
      .mockResolvedValueOnce(pageOf(first, 41, 1))
      .mockRejectedValueOnce(new AppError('NETWORK', 'Cannot reach the server. Check your connection and try again.'))
      .mockResolvedValueOnce(pageOf([saved(41)], 41, 3));
    renderLibrary({ library });

    await waitFor(() => expect(cards()).toHaveLength(20));
    fireEvent.click(screen.getByRole('button', { name: 'Page 3' }));

    expect(await screen.findByText('Cannot reach the server. Check your connection and try again.')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));

    await waitFor(() => expect(screen.getByText('Lid 41')).toBeTruthy());
  });

  it('shows each Spec ID with its code, its facts in plain words, what is missing and its last change', async () => {
    const ben = { id: '00000000-0000-4000-8000-0000000000bb', fullName: 'Ben Invented' };
    const lid = saved(1, { updatedBy: ben, updatedAt: new Date('2026-10-17T14:32:00Z'), manufacturerStages: { specificationsReceived: 2, quoted: 1, sampling: 0, inProduction: 0 } });
    renderLibrary({ library: async () => pageOf([lid]) });

    const [link] = await waitFor(() => cards());
    const card = link?.parentElement;
    // A card opens the Spec ID's manufacturers first (#57).
    expect(link?.getAttribute('href')).toBe(`/atlas/${lid.id}/manufacturers`);
    expect(within(card!).getByText('Lid 1')).toBeTruthy();
    expect(within(card!).getByText(ILLUSTRATIVE)).toBeTruthy();
    expect(within(card!).getByText('Bowl lid · APS · CL · RD · DM · 0090 · 0033')).toBeTruthy();
    expect(within(card!).getByText('4 not known')).toBeTruthy();
    expect(within(card!).getByText('Last updated by Ben Invented on 17 October 2026')).toBeTruthy();
    // How far its manufacturers have come (#73).
    expect(within(card!).getByRole('list', { name: 'Manufacturer stages' })).toBeTruthy();
    // Copy sits beside the code, outside the link, so it does not open the card.
    expect(link?.querySelector('button')).toBeNull();
    expect(within(card!).getByRole('button', { name: 'Copy code' })).toBeTruthy();
    expect(screen.queryByRole('navigation', { name: 'Spec ID pages' })).toBeNull();
  });

  it('marks a Spec ID with nothing missing as Complete', async () => {
    const complete = [
      ['coating', 'PE'],
      ['height', '0062'],
      ['thickness', '030'],
      ['print', 'NP'],
    ].reduce((code, [key, raw]) => withSlot(code, key as SlotKey, raw ?? ''), ILLUSTRATIVE);
    renderLibrary({ library: async () => pageOf([saved(1, { code: complete, slots: readCode(complete).slots })]) });
    expect(await screen.findByText('Complete')).toBeTruthy();
  });

  it('waits 250 ms after the last keystroke before it searches', async () => {
    const library = vi.fn<AtlasGateway['library']>(async () => EMPTY);
    renderLibrary({ library });
    await waitFor(() => expect(library).toHaveBeenCalledTimes(1));
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });

    search('li');
    act(() => vi.advanceTimersByTime(SEARCH_WAIT_MS - 50));
    search('lid');
    act(() => vi.advanceTimersByTime(SEARCH_WAIT_MS - 1));
    expect(library).toHaveBeenCalledTimes(1);
    act(() => vi.advanceTimersByTime(1));
    vi.useRealTimers();

    await waitFor(() => expect(library).toHaveBeenLastCalledWith({ q: 'lid', productType: '', page: 1 }));
    expect(library).toHaveBeenCalledTimes(2);
    expect(SEARCH_WAIT_MS).toBe(250);
  });

  it('says so when no name matches', async () => {
    renderLibrary();
    search('  zebra ');
    expect(await screen.findByText('No names match.')).toBeTruthy();
  });

  it('says nothing about a search until its own answer arrives', async () => {
    const pending: Array<(page: typeof EMPTY) => void> = [];
    let answered = false;
    renderLibrary({
      library: ({ q }) => {
        if (!q || answered) return Promise.resolve(EMPTY);
        return new Promise((resolve) => pending.push(resolve));
      },
    });
    await screen.findByText('No Spec IDs yet');

    search('zebra');
    await waitFor(() => expect(screen.queryByText('No Spec IDs yet')).toBeNull());
    await waitFor(() => expect(pending).not.toHaveLength(0));
    expect(screen.queryByText(/No names match/)).toBeNull();

    answered = true;
    act(() => {
      for (const resolve of pending.splice(0)) resolve(EMPTY);
    });
    expect(await screen.findByText('No names match.')).toBeTruthy();
  });

  it('invites the first Spec ID when none is saved at all', async () => {
    renderLibrary();
    expect(await screen.findByText('No Spec IDs yet')).toBeTruthy();
    expect(screen.getByText('Describe a product to give it its first code.')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'New Spec ID' }).getAttribute('href')).toBe('/atlas/new');
  });

  it('puts a refused search beside the box', async () => {
    const message = 'Search text must be at most 120 characters.';
    renderLibrary({
      library: async ({ q }) => {
        if (q) throw new AppError('VALIDATION_FAILED', 'The lookup is not valid.', { q: [message] });
        return EMPTY;
      },
    });
    search('x'.repeat(120));
    expect(await screen.findByText(message)).toBeTruthy();
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('does not ask the name search for text over 120 characters, and only reads it for its facts', async () => {
    const library = vi.fn<AtlasGateway['library']>(async () => EMPTY);
    const readText = vi.fn<AtlasGateway['readText']>(async () => ({ read: [], ignored: [], conflicts: [], notes: [], decoded: null }));
    renderLibrary({ library, readText });
    await screen.findByText('No Spec IDs yet');

    search('x'.repeat(121));

    await waitFor(() => expect(readText).toHaveBeenCalledWith({ text: 'x'.repeat(121) }, expect.any(AbortSignal)));
    expect(library).not.toHaveBeenCalledWith(expect.objectContaining({ q: 'x'.repeat(121) }));
    expect(screen.queryByText('Search text must be at most 120 characters.')).toBeNull();
    expect(screen.queryByText(/No names match/)).toBeNull();
  });

  it('shows any other failure with Try again', async () => {
    const library = vi
      .fn<AtlasGateway['library']>()
      .mockRejectedValueOnce(new AppError('NETWORK', 'Cannot reach the server. Check your connection and try again.'))
      .mockResolvedValue(pageOf([saved(1)]));
    renderLibrary({ library });

    expect(await screen.findByText('Cannot reach the server. Check your connection and try again.')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));

    expect(await screen.findByText('Lid 1')).toBeTruthy();
  });
});

describe('AtlasLibrary, until asked', () => {
  it('lists nothing until a name is asked for, then only the names that match', async () => {
    const library = vi.fn<AtlasGateway['library']>(async () => pageOf([saved(1)]));
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    renderLibrary({ library }, s1Dictionary, true);

    expect(screen.getByRole('searchbox', { name: 'Search' })).toBeTruthy();
    expect(screen.queryByText('Product type')).toBeNull();
    expect(screen.queryByText('No Spec IDs yet')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Search' })).toBeNull();

    act(() => vi.advanceTimersByTime(SEARCH_WAIT_MS));
    expect(library).not.toHaveBeenCalled();
    vi.useRealTimers();

    search('lid');

    expect(await screen.findByText('Lid 1')).toBeTruthy();
    expect(library).toHaveBeenLastCalledWith({ q: 'lid', productType: '', page: 1 });
    expect(screen.queryByRole('radiogroup', { name: 'Product type' })).toBeNull();

    search('');

    await waitFor(() => expect(screen.queryByText('Lid 1')).toBeNull());
    expect(screen.queryByText('Product type')).toBeNull();
  });
});

describe('AtlasLibrary, a pasted code', () => {
  it('finds a code pasted in lower case, with a note for each Spec ID that had it before', async () => {
    const until = new Date('2026-10-17T09:30:00Z');
    const findByCode = vi.fn<AtlasGateway['findByCode']>(async () =>
      lookupFor(ILLUSTRATIVE, 'Illustrative lid', {
        formerHolders: [{ id: '00000000-0000-4000-8000-000000000002', name: 'Old lid', code: 'S1.OTHER', until }],
      }),
    );
    renderLibrary({ findByCode });

    search(` ${ILLUSTRATIVE.toLowerCase()} `);

    expect(await screen.findByText('Saved as "Illustrative lid".')).toBeTruthy();
    expect(findByCode).toHaveBeenCalledWith(ILLUSTRATIVE);
    expect(screen.getAllByRole('link', { name: 'Open' }).map((link) => link.getAttribute('href'))).toEqual([
      '/atlas/00000000-0000-4000-8000-000000000001',
      '/atlas/00000000-0000-4000-8000-000000000002',
    ]);
    expect(screen.getByText('This code also belonged to "Old lid" until 17 October 2026. It\'s now S1.OTHER.')).toBeTruthy();
    expect(screen.queryByRole('radiogroup', { name: 'Product type' })).toBeNull();
  });

  it("shows a pasted code's Spec ID with its stage icons (#73)", async () => {
    renderLibrary({ findByCode: async () => lookupFor(ILLUSTRATIVE, 'Illustrative lid', { manufacturerStages: { specificationsReceived: 2, quoted: 1, sampling: 0, inProduction: 0 } }) });

    search(ILLUSTRATIVE);

    expect(await screen.findByRole('list', { name: 'Manufacturer stages' })).toBeTruthy();
  });

  it('finds the Spec ID a replaced code became', async () => {
    const now = withSlot(ILLUSTRATIVE, 'height', '0062');
    renderLibrary({ findByCode: async () => lookupFor(now, 'Illustrative lid', { replacedCode: ILLUSTRATIVE }) });

    search(ILLUSTRATIVE);

    expect(await screen.findByText(`This code was updated. It's now ${now}.`)).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Open' }).getAttribute('href')).toBe('/atlas/00000000-0000-4000-8000-000000000001');
  });

  it('reads a code nobody saved slot by slot, with the slots that do not apply folded, and the way to start one', async () => {
    renderLibrary({ findByCode: async () => Promise.reject(NOT_FOUND), decode: async (code) => readCode(code) });

    search(ILLUSTRATIVE);

    expect(await screen.findByText("This Spec ID isn't saved yet.")).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Start a Spec ID from it' }).getAttribute('href')).toBe(
      `/atlas/new?code=${encodeURIComponent(ILLUSTRATIVE)}`,
    );
    const fold = screen.getByText("14 slots don't apply").closest('details') as HTMLDetailsElement;
    expect(fold.open).toBe(false);
    const [shown] = screen.getAllByRole('table');
    // The header row, then the 11 slots that apply.
    expect(within(shown!).getAllByRole('row')).toHaveLength(12);
    // Each slot as a code writes it today; one not known is left out of the code.
    expect(within(shown!).getByRole('row', { name: /Material/ }).textContent).toContain('B4');
    expect(within(shown!).getByRole('row', { name: /Top diameter/ }).textContent).toContain('H90');
    expect(within(shown!).getByRole('row', { name: /Coating/ }).textContent).toBe('3CoatingNot known');
  });

  it('lists the saved Spec IDs with every fact in a code nobody saved, then those that might fit', async () => {
    const findSimilar = vi.fn<AtlasGateway['findSimilar']>(async () => ({
      fits: [savedFor(withSlot(ILLUSTRATIVE, 'height', '0012'), 'Lid, 12 mm high')],
      mightFit: [savedFor(withSlot(ILLUSTRATIVE, 'material', 'Y'), 'Lid, material not known')],
    }));
    renderLibrary({ findByCode: async () => Promise.reject(NOT_FOUND), decode: async (code) => readCode(code), findSimilar });

    search(ILLUSTRATIVE);

    const fits = await screen.findByRole('region', { name: 'Fits — every fact you gave matches' });
    expect(within(fits).getByText('Lid, 12 mm high')).toBeTruthy();
    const might = screen.getByRole('region', { name: "Might fit — nothing contradicts, but some facts aren't recorded" });
    expect(within(might).getByText('Lid, material not known')).toBeTruthy();
    expect(findSimilar).toHaveBeenCalledWith(expect.objectContaining({ productType: 'BLD', material: 'APS', topDiameter: '0090' }));
    expect(screen.getByText("This Spec ID isn't saved yet.")).toBeTruthy();
  });

  it('says when no saved Spec ID has every fact in a code nobody saved', async () => {
    renderLibrary({
      findByCode: async () => Promise.reject(NOT_FOUND),
      decode: async (code) => readCode(code),
      findSimilar: async () => ({ fits: [], mightFit: [] }),
    });

    search(ILLUSTRATIVE);

    expect(await screen.findByText('No saved Spec ID has every fact in this code.')).toBeTruthy();
  });

  it('finds a code written today, typed in lower case', async () => {
    const findByCode = vi.fn<AtlasGateway['findByCode']>(async () => lookupFor(ILLUSTRATIVE_V2, 'Illustrative lid'));
    renderLibrary({ findByCode });

    search(` ${ILLUSTRATIVE_V2.toLowerCase()} `);

    expect(await screen.findByText('Saved as "Illustrative lid".')).toBeTruthy();
    expect(findByCode).toHaveBeenCalledWith(ILLUSTRATIVE_V2);
  });

  it("shows only the decoder's messages for a code written today that it cannot read", async () => {
    const fields = { code: ['This key/part is unknown: Z9.', 'Product type (A) is missing. Every code includes it, for example A1.'] };
    renderLibrary({
      findByCode: async () => Promise.reject(NOT_FOUND),
      decode: async () => Promise.reject(new AppError('INVALID_SPEC_ID', 'The Spec ID is not valid.', fields)),
    });

    search('B4D1-H90');

    for (const message of fields.code) expect(await screen.findByText(message)).toBeTruthy();
    expect(screen.queryByRole('table')).toBeNull();
  });

  it('shows a refused dotted code with all 25 parts part by part, with the messages beside each', async () => {
    const fields = { productType: ['Product type: QQQ is not in the dictionary.'] };
    renderLibrary({
      findByCode: async () => Promise.reject(NOT_FOUND),
      decode: async () => Promise.reject(new AppError('INVALID_SPEC_ID', 'The Spec ID is not valid.', fields)),
    });

    search(withSlot(ILLUSTRATIVE, 'productType', 'QQQ'));

    const row = await screen.findByRole('row', { name: /Product type/ });
    expect(row.textContent).toContain('QQQ');
    expect(within(row).getByRole('alert').textContent).toBe('Product type: QQQ is not in the dictionary.');
  });

  it("shows the decoder's messages for a code it cannot read", async () => {
    const fields = { code: ['A Spec ID has 25 parts separated by dots. This one has 4.'] };
    renderLibrary({
      findByCode: async () => Promise.reject(NOT_FOUND),
      decode: async () => Promise.reject(new AppError('INVALID_SPEC_ID', 'The Spec ID is not valid.', fields)),
    });

    search('BLD.APS.Y.CL');

    expect(await screen.findByText('A Spec ID has 25 parts separated by dots. This one has 4.')).toBeTruthy();
    expect(screen.queryByRole('table')).toBeNull();
  });
});
