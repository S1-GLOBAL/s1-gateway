import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { AppError } from '@/shared/application/app-error';
import type { AtlasGateway } from '../../application/atlas-gateway';
import { AtlasGatewayProvider } from '../../application/atlas-gateway-context';
import { SpecIdExistsError } from '../../application/spec-id-exists-error';
import { gatewayWith, ILLUSTRATIVE, lookupFor, readCode, s1Dictionary, savedFor } from '../../application/testing/atlas-fixtures';
import type { DecodedSpecId, SpecIdTextReading } from '../../domain/atlas';
import { AtlasLibrary, READ_MIN_LENGTH, SEARCH_WAIT_MS } from './AtlasLibrary';

const TEXT = '14oz Bagasse Bowl for Cava';
const BOWL = 'BWL.CBG.Y.Y.Y.X.Z0014.Y.Y.Y.Y.Y.X.Y.X.Y.Y.Y.Y.X.X.X.X.X.X';
const MEANINGS: Record<string, string> = { productType: 'Bowl', material: 'Molded fibre, bagasse', capacity: '14 oz' };

/** The example's code, its three known slots in words. */
const bowl: DecodedSpecId = {
  ...readCode(BOWL),
  slots: readCode(BOWL).slots.map((slot) => ({ ...slot, meaning: MEANINGS[slot.key] ?? slot.meaning })),
};

const READ_BOWL: SpecIdTextReading = {
  read: [
    { key: 'productType', name: 'Product type', meaning: 'Bowl', words: 'Bowl', ruling: null },
    { key: 'material', name: 'Material', meaning: 'Molded fibre, bagasse', words: 'Bagasse', ruling: null },
    { key: 'capacity', name: 'Nominal capacity', meaning: '14 oz', words: '14oz', ruling: null },
  ],
  ignored: ['for', 'Cava'],
  conflicts: [],
  notes: [],
  decoded: bowl,
};

const EMPTY = { items: [], page: 1, pageSize: 20, total: 0 };

function renderLibrary(overrides: Partial<AtlasGateway> = {}) {
  const gateway = gatewayWith({ library: vi.fn(async () => EMPTY), ...overrides });
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={queryClient}>
      <AtlasGatewayProvider gateway={gateway}>
        <MemoryRouter>
          <AtlasLibrary dictionary={s1Dictionary} timeZone="UTC" />
        </MemoryRouter>
      </AtlasGatewayProvider>
    </QueryClientProvider>,
  );
  return gateway;
}

const type = (text: string) => fireEvent.change(screen.getByLabelText('Search'), { target: { value: text } });

describe('AtlasLibrary, Search', () => {
  it('reads text that is not a code as it is typed, with no button to press, and never a pasted code', async () => {
    const readText = vi.fn<AtlasGateway['readText']>(async () => READ_BOWL);
    renderLibrary({ readText });
    expect(screen.queryByRole('button', { name: 'Search' })).toBeNull();

    type('bagasse bowl');
    await waitFor(() => expect(readText).toHaveBeenCalledWith({ text: 'bagasse bowl' }, expect.any(AbortSignal)));

    type(ILLUSTRATIVE.toLowerCase());
    await new Promise((resolve) => setTimeout(resolve, SEARCH_WAIT_MS * 2));
    type('   ');
    expect(readText).toHaveBeenCalledTimes(1);
  });

  it('reads the text, then shows the code, each fact it read and what it left out, and No, edit it opens New Spec ID', async () => {
    const readText = vi.fn<AtlasGateway['readText']>(async () => READ_BOWL);
    renderLibrary({ readText });

    type(`  ${TEXT} `);

    expect(await screen.findByText('Does this code look right?')).toBeTruthy();
    expect(readText).toHaveBeenCalledWith({ text: TEXT }, expect.any(AbortSignal));
    expect(screen.getByLabelText('Spec ID').textContent).toBe(BOWL);
    const facts = screen.getByRole('list', { name: 'Read from your text' });
    expect(within(facts).getAllByRole('listitem').map((item) => item.textContent)).toEqual([
      'Product type: Bowl',
      'Material: Molded fibre, bagasse',
      'Nominal capacity: 14 oz',
    ]);
    expect(screen.getByText('Left out: for, Cava')).toBeTruthy();
    // Nothing to press before the Spec IDs that fit are looked up.
    expect(screen.queryByRole('button', { name: 'Yes, proceed' })).toBeNull();
    expect(screen.getByRole('link', { name: 'No, edit it' }).getAttribute('href')).toBe(
      `/atlas/new?code=${encodeURIComponent(BOWL)}`,
    );
  });

  it('says nothing about words left out when there were none', async () => {
    renderLibrary({ readText: async () => ({ ...READ_BOWL, ignored: [] }) });
    type('14oz Bagasse Bowl');

    await screen.findByText('Does this code look right?');
    expect(screen.queryByText(/Left out:/)).toBeNull();
  });

  it("lists the reader's notes, such as a fact found twice, one sentence each", async () => {
    const notes = [
      'Material: PET is Polymer, PET (B1). PP is Polymer, PP (B3). Both were left out.',
      'The 3.25 inch height was converted to 83 mm.',
    ];
    renderLibrary({
      readText: async () => ({
        ...READ_BOWL,
        conflicts: [{ key: 'material', name: 'Material', found: ['PET', 'PP'] }],
        notes,
      }),
    });
    type('PET and PP bowl');

    const list = await screen.findByRole('list', { name: 'Notes' });
    expect(within(list).getAllByRole('listitem').map((item) => item.textContent)).toEqual(notes);
  });

  it('shows no notes when the reader has none', async () => {
    renderLibrary({ readText: async () => READ_BOWL });
    type(TEXT);

    await screen.findByText('Does this code look right?');
    expect(screen.queryByRole('list', { name: 'Notes' })).toBeNull();
  });

  it('asks for the product type when the text names none, and reads the text again as the one chosen', async () => {
    const noType: SpecIdTextReading = { ...READ_BOWL, read: READ_BOWL.read.slice(1), ignored: [], decoded: null };
    const readText = vi
      .fn<AtlasGateway['readText']>()
      .mockResolvedValueOnce(noType)
      .mockResolvedValueOnce(READ_BOWL);
    renderLibrary({ readText });
    type('14oz bagasse');

    expect(await screen.findByText("Couldn't tell what product this is. Choose a product type:")).toBeTruthy();
    const facts = screen.getByRole('list', { name: 'Read from your text' });
    expect(within(facts).getAllByRole('listitem').map((item) => item.textContent)).toEqual([
      'Material: Molded fibre, bagasse',
      'Nominal capacity: 14 oz',
    ]);
    fireEvent.change(screen.getByLabelText('Product type to read as'), { target: { value: 'BWL' } });

    expect(await screen.findByText('Does this code look right?')).toBeTruthy();
    expect(readText).toHaveBeenLastCalledWith({ text: '14oz bagasse', productType: 'BWL' }, expect.any(AbortSignal));
  });

  it('says when it found no facts, with New Spec ID', async () => {
    renderLibrary({
      readText: async () => ({ read: [], ignored: ['Cava', 'order', '12'], conflicts: [], notes: [], decoded: null }),
    });
    type('Cava order 12');

    expect(
      await screen.findByText('No facts found in your text. Check the wording, or start a Spec ID by hand.'),
    ).toBeTruthy();
    expect(screen.getByRole('link', { name: 'New Spec ID' }).getAttribute('href')).toBe('/atlas/new');
  });

  it('lists the Spec IDs that fit before those that might as the text is read, and saves nothing', async () => {
    const fits = savedFor(BOWL, '14oz Bagasse Bowl', { id: '00000000-0000-4000-8000-000000000001', manufacturerStages: { specificationsReceived: 2, quoted: 1, sampling: 0, inProduction: 0 } });
    const might = savedFor(BOWL, 'Bagasse bowl, size unknown', { id: '00000000-0000-4000-8000-000000000002' });
    const findSimilar = vi.fn<AtlasGateway['findSimilar']>(async () => ({ fits: [fits], mightFit: [might] }));
    const save = vi.fn<AtlasGateway['save']>();
    renderLibrary({ readText: async () => READ_BOWL, findSimilar, save });
    type(TEXT);

    const headings = await screen.findAllByRole('heading');
    expect(headings.map((heading) => heading.textContent)).toEqual([
      'Fits — every fact you gave matches',
      "Might fit — nothing contradicts, but some facts aren't recorded",
    ]);
    // Fits and Might fit cards open the Spec ID's manufacturers first (#57).
    expect(screen.getByRole('link', { name: /14oz Bagasse Bowl/ }).getAttribute('href')).toBe(`/atlas/${fits.id}/manufacturers`);
    expect(screen.getByRole('link', { name: /Bagasse bowl, size unknown/ }).getAttribute('href')).toBe(
      `/atlas/${might.id}/manufacturers`,
    );
    // The fits card shows its stage icons (#73). Copy sits beside the code, outside the link.
    const fitsCard = screen.getByRole('link', { name: /14oz Bagasse Bowl/ }).parentElement!;
    expect(within(fitsCard).getByRole('list', { name: 'Manufacturer stages' })).toBeTruthy();
    expect(within(fitsCard).getByRole('button', { name: 'Copy code' })).toBeTruthy();
    expect(findSimilar).toHaveBeenCalledWith({ productType: 'BWL', material: 'CBG', capacity: 'Z0014' });
    expect(save).not.toHaveBeenCalled();
  });

  it('says when nothing fits, with Start a Spec ID from it, before those that might fit', async () => {
    const might = savedFor(BOWL, 'Bagasse bowl, size unknown', { id: '00000000-0000-4000-8000-000000000002' });
    renderLibrary({ readText: async () => READ_BOWL, findSimilar: async () => ({ fits: [], mightFit: [might] }) });
    type(TEXT);

    const nothing = await screen.findByText('No saved Spec ID fits these facts.');
    const start = screen.getByRole('link', { name: 'Start a Spec ID from it' });
    expect(start.getAttribute('href')).toBe(`/atlas/new?code=${encodeURIComponent(BOWL)}`);
    const mightFit = screen.getByRole('heading', { name: /Might fit/ });
    expect(nothing.compareDocumentPosition(mightFit) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('shows a saved Spec ID with exactly the facts read as a perfect match, instead of the code to confirm', async () => {
    const findByCode = vi.fn<AtlasGateway['findByCode']>(async () => lookupFor(BOWL, 'Bagasse bowl, 14 oz'));
    renderLibrary({ readText: async () => READ_BOWL, findByCode });
    type(TEXT);

    const match = await screen.findByRole('region', { name: 'Perfect match' });
    expect(within(match).getByText('We found a perfect match!')).toBeTruthy();
    expect(within(match).getByText('Bagasse bowl, 14 oz')).toBeTruthy();
    expect(findByCode).toHaveBeenCalledWith(BOWL);
    expect(screen.queryByText('Does this code look right?')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Yes, proceed' })).toBeNull();
    expect(
      within(match).getByRole('link', { name: "This is not what I'm looking for, create a Spec ID" }).getAttribute('href'),
    ).toBe(`/atlas/new?code=${encodeURIComponent(BOWL)}`);
  });

  it('lists the Spec IDs that fit and might under a perfect match, leaving the match out', async () => {
    const match = lookupFor(BOWL, 'Bagasse bowl, 14 oz');
    const also = savedFor(BOWL, 'Bagasse bowl with more facts', { id: '00000000-0000-4000-8000-0000000000c1' });
    const might = savedFor(BOWL, 'Bagasse bowl, size unknown', { id: '00000000-0000-4000-8000-0000000000c2' });
    renderLibrary({
      readText: async () => READ_BOWL,
      findByCode: async () => match,
      findSimilar: async () => ({ fits: [match, also], mightFit: [might] }),
    });
    type(TEXT);

    await screen.findByRole('region', { name: 'Perfect match' });
    const fits = await screen.findByRole('region', { name: 'Fits — every fact you gave matches' });
    expect(within(fits).getByText('Bagasse bowl with more facts')).toBeTruthy();
    expect(within(fits).queryByText('Bagasse bowl, 14 oz')).toBeNull();
    expect(screen.getByRole('region', { name: "Might fit — nothing contradicts, but some facts aren't recorded" })).toBeTruthy();
    expect(screen.queryByText('No saved Spec ID fits these facts.')).toBeNull();
  });

  it('says nothing fits under a perfect match that is the only fit', async () => {
    const match = lookupFor(BOWL, 'Bagasse bowl, 14 oz');
    renderLibrary({ readText: async () => READ_BOWL, findByCode: async () => match, findSimilar: async () => ({ fits: [match], mightFit: [] }) });
    type(TEXT);

    await screen.findByRole('region', { name: 'Perfect match' });
    await waitFor(() => expect(screen.queryByRole('heading', { name: /Fits/ })).toBeNull());
    expect(screen.queryByText('No saved Spec ID fits these facts.')).toBeNull();
    expect(screen.queryByRole('button', { name: /Save as a new Spec ID/ })).toBeNull();
  });

  it('leaves the perfect match out of the names below it, keeping the others', async () => {
    const match = lookupFor(BOWL, 'Bagasse bowl, 14 oz');
    const other = savedFor(ILLUSTRATIVE, 'Bagasse bowl lid');
    renderLibrary({
      readText: async () => READ_BOWL,
      findByCode: async () => match,
      library: async () => ({ items: [match, { ...other, id: '00000000-0000-4000-8000-0000000000b2' }], page: 1, pageSize: 20, total: 2 }),
    });
    type(TEXT);

    await screen.findByRole('region', { name: 'Perfect match' });
    expect(await screen.findByText('Bagasse bowl lid')).toBeTruthy();
    expect(screen.getAllByText('Bagasse bowl, 14 oz')).toHaveLength(1);
  });

  it('says nothing under a perfect match when it was the only name that matched', async () => {
    const match = lookupFor(BOWL, 'Bagasse bowl, 14 oz');
    renderLibrary({
      readText: async () => READ_BOWL,
      findByCode: async () => match,
      library: async () => ({ items: [match], page: 1, pageSize: 20, total: 1 }),
    });
    type(TEXT);

    await screen.findByRole('region', { name: 'Perfect match' });
    await waitFor(() => expect(screen.getAllByText('Bagasse bowl, 14 oz')).toHaveLength(1));
    expect(screen.queryByText('No names match.')).toBeNull();
  });

  it('asks to confirm the code when no saved Spec ID has it', async () => {
    renderLibrary({
      readText: async () => READ_BOWL,
      findByCode: async () => Promise.reject(new AppError('SPEC_ID_NOT_FOUND', 'No saved Spec ID has this code.')),
    });
    type(TEXT);

    expect(await screen.findByText('Does this code look right?')).toBeTruthy();
    await waitFor(() => expect(screen.queryByRole('region', { name: 'Perfect match' })).toBeNull());
  });

  it('reads nothing for one character', async () => {
    const readText = vi.fn<AtlasGateway['readText']>(async () => READ_BOWL);
    renderLibrary({ readText });
    type('b');
    await new Promise((resolve) => setTimeout(resolve, SEARCH_WAIT_MS * 2));
    expect(readText).not.toHaveBeenCalled();

    type('bo');
    await waitFor(() => expect(readText).toHaveBeenCalledWith({ text: 'bo' }, expect.any(AbortSignal)));
    expect(READ_MIN_LENGTH).toBe(2);
  });

  it('stops the request for text that has since changed', async () => {
    const signals: AbortSignal[] = [];
    const readText = vi.fn<AtlasGateway['readText']>((_input, signal) => {
      if (signal) signals.push(signal);
      return signals.length === 1 ? new Promise(() => undefined) : Promise.resolve(READ_BOWL);
    });
    renderLibrary({ readText });
    type(TEXT);
    await waitFor(() => expect(signals).toHaveLength(1));

    type(`${TEXT} lid`);
    await waitFor(() => expect(signals).toHaveLength(2));
    await waitFor(() => expect(signals[0]?.aborted).toBe(true));
    expect(signals[1]?.aborted).toBe(false);
  });

  it('reads the text again as it changes, keeping the last reading until the next arrives, above the name list', async () => {
    let answer: (reading: SpecIdTextReading) => void = () => undefined;
    const readText = vi
      .fn<AtlasGateway['readText']>()
      .mockResolvedValueOnce(READ_BOWL)
      .mockImplementationOnce(() => new Promise((resolve) => (answer = resolve)));
    renderLibrary({ readText });
    await screen.findByText('No Spec IDs yet');
    type(TEXT);

    expect((await screen.findByLabelText('Spec ID')).textContent).toBe(BOWL);
    expect(screen.queryByRole('radiogroup', { name: 'Product type' })).toBeNull();
    expect(await screen.findByText('No names match.')).toBeTruthy();

    type(`${TEXT} lid`);
    await waitFor(() => expect(readText).toHaveBeenLastCalledWith({ text: `${TEXT} lid` }, expect.any(AbortSignal)));
    expect(screen.getByLabelText('Spec ID').textContent).toBe(BOWL);
    expect(screen.getByRole('region', { name: 'What Search read' }).getAttribute('aria-busy')).toBe('true');

    answer({ ...READ_BOWL, decoded: { ...bowl, code: 'A1B25' } });
    await waitFor(() => expect(screen.getByLabelText('Spec ID').textContent).toBe('A1B25'));
    expect(screen.getByRole('region', { name: 'What Search read' }).getAttribute('aria-busy')).toBe('false');
  });

  it('puts refused text beside the box', async () => {
    const message = 'Search text must be at most 500 characters.';
    renderLibrary({
      readText: async () => {
        throw new AppError('VALIDATION_FAILED', 'The lookup is not valid.', { text: [message] });
      },
    });
    type('x '.repeat(251));

    expect(await screen.findByText(message)).toBeTruthy();
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('shows any other failure with Try again, which reads the text again', async () => {
    const readText = vi
      .fn<AtlasGateway['readText']>()
      .mockRejectedValueOnce(new AppError('NETWORK', 'Cannot reach the server. Check your connection and try again.'))
      .mockResolvedValue(READ_BOWL);
    renderLibrary({ readText });
    type(TEXT);

    expect(await screen.findByText('Cannot reach the server. Check your connection and try again.')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));

    expect(await screen.findByText('Does this code look right?')).toBeTruthy();
    await waitFor(() => expect(readText).toHaveBeenCalledTimes(2));
    expect(readText).toHaveBeenLastCalledWith({ text: TEXT }, expect.any(AbortSignal));
  });
});

/** Where a save lands: the address, and the notice it carries. */
function SavedPage() {
  const location = useLocation();
  const notice = (location.state as { notice?: string } | null)?.notice ?? '';
  return <p>{`Opened ${location.pathname}: ${notice}`}</p>;
}

/** The library at /atlas, with a page for /atlas/<id> to open after a save. */
function renderLibraryWithRoutes(overrides: Partial<AtlasGateway> = {}) {
  const gateway = gatewayWith({ library: vi.fn(async () => EMPTY), readText: async () => READ_BOWL, ...overrides });
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={queryClient}>
      <AtlasGatewayProvider gateway={gateway}>
        <MemoryRouter initialEntries={['/atlas']}>
          <Routes>
            <Route path="/atlas" element={<AtlasLibrary dictionary={s1Dictionary} timeZone="UTC" />} />
            <Route path="/atlas/:id" element={<SavedPage />} />
          </Routes>
        </MemoryRouter>
      </AtlasGatewayProvider>
    </QueryClientProvider>,
  );
  return gateway;
}

/** Searches the example: the Spec IDs that fit show as it is read. */
async function searchTheExample() {
  type(TEXT);
  await screen.findByText('Does this code look right?');
}

const NOTHING_FITS = async () => ({ fits: [], mightFit: [] });

describe('AtlasLibrary, saving from Search', () => {
  it('saves the code under the search text when nothing fits, and opens the saved Spec ID', async () => {
    const saved = savedFor(BOWL, TEXT, { id: '00000000-0000-4000-8000-000000000048' });
    const save = vi.fn<AtlasGateway['save']>(async () => saved);
    renderLibraryWithRoutes({ findSimilar: NOTHING_FITS, save });
    await searchTheExample();

    const name = await screen.findByLabelText('Name');
    expect((name as HTMLInputElement).value).toBe(TEXT);
    fireEvent.click(screen.getByRole('button', { name: 'Save as a new Spec ID' }));

    expect(await screen.findByText(`Opened /atlas/${saved.id}: Saved ${BOWL} as "${TEXT}".`)).toBeTruthy();
    expect(save).toHaveBeenCalledTimes(1);
    expect(save).toHaveBeenCalledWith({
      name: TEXT,
      facts: expect.objectContaining({ productType: 'BWL', material: 'CBG', capacity: { unit: 'Z', value: '14' } }),
    });
  });

  it('saves the name as changed', async () => {
    const save = vi.fn<AtlasGateway['save']>(async () =>
      savedFor(BOWL, '14oz Bagasse Bowl', { id: '00000000-0000-4000-8000-000000000049' }),
    );
    renderLibraryWithRoutes({ findSimilar: NOTHING_FITS, save });
    await searchTheExample();

    fireEvent.change(await screen.findByLabelText('Name'), { target: { value: '14oz Bagasse Bowl' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save as a new Spec ID' }));

    await waitFor(() => expect(save).toHaveBeenCalledWith(expect.objectContaining({ name: '14oz Bagasse Bowl' })));
  });

  it('offers no save while a saved Spec ID fits', async () => {
    const fits = savedFor(BOWL, '14oz Bagasse Bowl', { id: '00000000-0000-4000-8000-000000000001' });
    renderLibraryWithRoutes({ findSimilar: async () => ({ fits: [fits], mightFit: [] }) });
    await searchTheExample();

    await screen.findByRole('heading', { name: 'Fits — every fact you gave matches' });
    expect(screen.queryByLabelText('Name')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Save as a new Spec ID' })).toBeNull();
  });

  it('offers the save when nothing fits, even when some might', async () => {
    const might = savedFor(BOWL, 'Bagasse bowl, size unknown', { id: '00000000-0000-4000-8000-000000000002' });
    renderLibraryWithRoutes({ findSimilar: async () => ({ fits: [], mightFit: [might] }) });
    await searchTheExample();

    expect(await screen.findByRole('button', { name: 'Save as a new Spec ID' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: /Might fit/ })).toBeTruthy();
  });

  it('says so when the code is already saved, with the way to it, and opens nothing', async () => {
    const existing = savedFor(BOWL, '14oz Bagasse Bowl', { id: '00000000-0000-4000-8000-000000000003' });
    renderLibraryWithRoutes({
      findSimilar: NOTHING_FITS,
      save: async () => {
        throw new SpecIdExistsError(existing, 'This Spec ID already exists. Nothing new was saved.');
      },
    });
    await searchTheExample();
    fireEvent.click(await screen.findByRole('button', { name: 'Save as a new Spec ID' }));

    expect(
      await screen.findByText(/^This Spec ID already exists, saved as "14oz Bagasse Bowl" by .+\. Nothing new was saved\.$/),
    ).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Open' }).getAttribute('href')).toBe(`/atlas/${existing.id}`);
    expect(screen.queryByText(/^Opened /)).toBeNull();
  });

  it('puts a refused name under the field', async () => {
    const message = 'Name must be at most 120 characters.';
    renderLibraryWithRoutes({
      findSimilar: NOTHING_FITS,
      save: async () => {
        throw new AppError('INVALID_SPEC_ID', 'The Spec ID is not valid.', { name: [message] });
      },
    });
    await searchTheExample();
    fireEvent.click(await screen.findByRole('button', { name: 'Save as a new Spec ID' }));

    expect(await screen.findByText(message)).toBeTruthy();
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('says to sign in when the session has ended, and the failure itself otherwise', async () => {
    const save = vi
      .fn<AtlasGateway['save']>()
      .mockRejectedValueOnce(new AppError('SIGN_IN_REQUIRED', 'Sign in to continue.'))
      .mockRejectedValueOnce(new AppError('NETWORK', 'Cannot reach the server. Check your connection and try again.'));
    renderLibraryWithRoutes({ findSimilar: NOTHING_FITS, save });
    await searchTheExample();

    fireEvent.click(await screen.findByRole('button', { name: 'Save as a new Spec ID' }));
    expect(await screen.findByText('Sign in to save Spec IDs.')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Save as a new Spec ID' }));
    expect(await screen.findByText('Cannot reach the server. Check your connection and try again.')).toBeTruthy();
  });
});
