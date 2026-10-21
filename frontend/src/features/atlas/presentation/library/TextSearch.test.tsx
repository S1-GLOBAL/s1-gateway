import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { AppError } from '@/shared/application/app-error';
import type { AtlasGateway } from '../../application/atlas-gateway';
import { AtlasGatewayProvider } from '../../application/atlas-gateway-context';
import { SpecIdExistsError } from '../../application/spec-id-exists-error';
import { gatewayWith, ILLUSTRATIVE, readCode, s1Dictionary, savedFor } from '../../application/testing/atlas-fixtures';
import type { DecodedSpecId, SpecIdTextReading } from '../../domain/atlas';
import { AtlasLibrary } from './AtlasLibrary';

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
  decoded: bowl,
};

const EMPTY = { items: [], nextCursor: null };

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
const pressSearch = () => fireEvent.click(screen.getByRole('button', { name: 'Search' }));

describe('AtlasLibrary, Search', () => {
  it('offers Search for text that is not a code, and not for a pasted code', () => {
    renderLibrary();

    type('bagasse bowl');
    expect(screen.getByRole('button', { name: 'Search' })).toBeTruthy();

    type(ILLUSTRATIVE.toLowerCase());
    expect(screen.queryByRole('button', { name: 'Search' })).toBeNull();

    type('   ');
    expect(screen.queryByRole('button', { name: 'Search' })).toBeNull();
  });

  it('reads the text, then shows what it read, what it ignored and the code, and No, edit it opens New Spec ID', async () => {
    const readText = vi.fn<AtlasGateway['readText']>(async () => READ_BOWL);
    renderLibrary({ readText });

    type(`  ${TEXT} `);
    pressSearch();

    expect(await screen.findByText('Does this code look right?')).toBeTruthy();
    expect(readText).toHaveBeenCalledWith({ text: TEXT });
    expect(screen.getByText('Read from your text: Bowl · Molded fibre, bagasse · 14 oz')).toBeTruthy();
    expect(screen.getByText('Ignored: for, Cava')).toBeTruthy();
    expect(screen.getByText(BOWL)).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Yes, proceed' })).toBeTruthy();
    expect(screen.getByRole('link', { name: 'No, edit it' }).getAttribute('href')).toBe(
      `/atlas/new?code=${encodeURIComponent(BOWL)}`,
    );
  });

  it('says nothing about ignored words when there were none', async () => {
    renderLibrary({ readText: async () => ({ ...READ_BOWL, ignored: [] }) });
    type('14oz Bagasse Bowl');
    pressSearch();

    await screen.findByText('Does this code look right?');
    expect(screen.queryByText(/Ignored:/)).toBeNull();
  });

  it('names each fact found twice', async () => {
    renderLibrary({
      readText: async () => ({ ...READ_BOWL, conflicts: [{ key: 'material', name: 'Material', found: ['PET', 'PP'] }] }),
    });
    type('PET and PP bowl');
    pressSearch();

    expect(await screen.findByText("Material: found both PET and PP, so it's left as not known.")).toBeTruthy();
  });

  it('asks for the product type when the text names none, and reads the text again as the one chosen', async () => {
    const noType: SpecIdTextReading = { ...READ_BOWL, read: READ_BOWL.read.slice(1), ignored: [], decoded: null };
    const readText = vi
      .fn<AtlasGateway['readText']>()
      .mockResolvedValueOnce(noType)
      .mockResolvedValueOnce(READ_BOWL);
    renderLibrary({ readText });
    type('14oz bagasse');
    pressSearch();

    expect(await screen.findByText("Couldn't tell what product this is. Choose a product type:")).toBeTruthy();
    expect(screen.getByText('Read from your text: Molded fibre, bagasse · 14 oz')).toBeTruthy();
    fireEvent.change(screen.getByLabelText('Product type'), { target: { value: 'BWL' } });

    expect(await screen.findByText('Does this code look right?')).toBeTruthy();
    expect(readText).toHaveBeenLastCalledWith({ text: '14oz bagasse', productType: 'BWL' });
  });

  it('says when it found no facts, with New Spec ID', async () => {
    renderLibrary({ readText: async () => ({ read: [], ignored: ['Cava', 'order', '12'], conflicts: [], decoded: null }) });
    type('Cava order 12');
    pressSearch();

    expect(
      await screen.findByText('No facts found in your text. Check the wording, or start a Spec ID by hand.'),
    ).toBeTruthy();
    expect(screen.getByRole('link', { name: 'New Spec ID' }).getAttribute('href')).toBe('/atlas/new');
  });

  it('Yes, proceed lists the Spec IDs that fit before those that might, and saves nothing', async () => {
    const fits = savedFor(BOWL, '14oz Bagasse Bowl', { id: '00000000-0000-4000-8000-000000000001' });
    const might = savedFor(BOWL, 'Bagasse bowl, size unknown', { id: '00000000-0000-4000-8000-000000000002' });
    const findSimilar = vi.fn<AtlasGateway['findSimilar']>(async () => ({ fits: [fits], mightFit: [might] }));
    const save = vi.fn<AtlasGateway['save']>();
    renderLibrary({ readText: async () => READ_BOWL, findSimilar, save });
    type(TEXT);
    pressSearch();

    fireEvent.click(await screen.findByRole('button', { name: 'Yes, proceed' }));

    const headings = await screen.findAllByRole('heading');
    expect(headings.map((heading) => heading.textContent)).toEqual([
      'Fits — every fact you gave matches',
      "Might fit — nothing contradicts, but some facts aren't recorded",
    ]);
    expect(screen.getByRole('link', { name: /14oz Bagasse Bowl/ }).getAttribute('href')).toBe(`/atlas/${fits.id}`);
    expect(screen.getByRole('link', { name: /Bagasse bowl, size unknown/ }).getAttribute('href')).toBe(
      `/atlas/${might.id}`,
    );
    expect(findSimilar).toHaveBeenCalledWith({ productType: 'BWL', material: 'CBG', capacity: 'Z0014' });
    expect(save).not.toHaveBeenCalled();
  });

  it('says when nothing fits, with Start a Spec ID from it, before those that might fit', async () => {
    const might = savedFor(BOWL, 'Bagasse bowl, size unknown', { id: '00000000-0000-4000-8000-000000000002' });
    renderLibrary({ readText: async () => READ_BOWL, findSimilar: async () => ({ fits: [], mightFit: [might] }) });
    type(TEXT);
    pressSearch();
    fireEvent.click(await screen.findByRole('button', { name: 'Yes, proceed' }));

    const nothing = await screen.findByText('No saved Spec ID fits these facts.');
    const start = screen.getByRole('link', { name: 'Start a Spec ID from it' });
    expect(start.getAttribute('href')).toBe(`/atlas/new?code=${encodeURIComponent(BOWL)}`);
    const mightFit = screen.getByRole('heading', { name: /Might fit/ });
    expect(nothing.compareDocumentPosition(mightFit) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('hides the type filter while Search shows, and goes back to the name list when the text changes', async () => {
    renderLibrary({ readText: async () => READ_BOWL });
    await screen.findByText('No Spec IDs yet');
    type(TEXT);
    pressSearch();

    await screen.findByText('Does this code look right?');
    expect(screen.queryByRole('radio', { name: 'All' })).toBeNull();

    type(`${TEXT}s`);

    expect(screen.queryByText('Does this code look right?')).toBeNull();
    expect(screen.getByRole('radio', { name: 'All' })).toBeTruthy();
    expect(await screen.findByText('No names match. Press Search to read the facts from your text.')).toBeTruthy();
  });

  it('puts refused text beside the box', async () => {
    const message = 'Search text must be at most 500 characters.';
    renderLibrary({
      readText: async () => {
        throw new AppError('VALIDATION_FAILED', 'The lookup is not valid.', { text: [message] });
      },
    });
    type('x '.repeat(251));
    pressSearch();

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
    pressSearch();

    expect(await screen.findByText('Cannot reach the server. Check your connection and try again.')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));

    expect(await screen.findByText('Does this code look right?')).toBeTruthy();
    await waitFor(() => expect(readText).toHaveBeenCalledTimes(2));
    expect(readText).toHaveBeenLastCalledWith({ text: TEXT });
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

/** Searches the example and presses Yes, proceed. */
async function searchAndProceed() {
  type(TEXT);
  pressSearch();
  fireEvent.click(await screen.findByRole('button', { name: 'Yes, proceed' }));
}

const NOTHING_FITS = async () => ({ fits: [], mightFit: [] });

describe('AtlasLibrary, saving from Search', () => {
  it('saves the code under the search text when nothing fits, and opens the saved Spec ID', async () => {
    const saved = savedFor(BOWL, TEXT, { id: '00000000-0000-4000-8000-000000000048' });
    const save = vi.fn<AtlasGateway['save']>(async () => saved);
    renderLibraryWithRoutes({ findSimilar: NOTHING_FITS, save });
    await searchAndProceed();

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
    await searchAndProceed();

    fireEvent.change(await screen.findByLabelText('Name'), { target: { value: '14oz Bagasse Bowl' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save as a new Spec ID' }));

    await waitFor(() => expect(save).toHaveBeenCalledWith(expect.objectContaining({ name: '14oz Bagasse Bowl' })));
  });

  it('offers no save while a saved Spec ID fits', async () => {
    const fits = savedFor(BOWL, '14oz Bagasse Bowl', { id: '00000000-0000-4000-8000-000000000001' });
    renderLibraryWithRoutes({ findSimilar: async () => ({ fits: [fits], mightFit: [] }) });
    await searchAndProceed();

    await screen.findByRole('heading', { name: 'Fits — every fact you gave matches' });
    expect(screen.queryByLabelText('Name')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Save as a new Spec ID' })).toBeNull();
  });

  it('offers the save when nothing fits, even when some might', async () => {
    const might = savedFor(BOWL, 'Bagasse bowl, size unknown', { id: '00000000-0000-4000-8000-000000000002' });
    renderLibraryWithRoutes({ findSimilar: async () => ({ fits: [], mightFit: [might] }) });
    await searchAndProceed();

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
    await searchAndProceed();
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
    await searchAndProceed();
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
    await searchAndProceed();

    fireEvent.click(await screen.findByRole('button', { name: 'Save as a new Spec ID' }));
    expect(await screen.findByText('Sign in to save Spec IDs.')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Save as a new Spec ID' }));
    expect(await screen.findByText('Cannot reach the server. Check your connection and try again.')).toBeTruthy();
  });
});
