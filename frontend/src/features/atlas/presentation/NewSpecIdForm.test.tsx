import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation, useParams } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { AppError } from '@/shared/application/app-error';
import type { AtlasGateway } from '../application/atlas-gateway';
import { AtlasGatewayProvider } from '../application/atlas-gateway-context';
import { SpecIdExistsError } from '../application/spec-id-exists-error';
import {
  gatewayWith,
  ILLUSTRATIVE,
  lookupFor,
  readCode,
  s2Dictionary,
  savedFor,
  testDictionary,
} from '../application/testing/atlas-fixtures';
import type { AtlasDictionary } from '../domain/atlas';
import { NewSpecIdForm, type SavedNotice } from './NewSpecIdForm';

const NOT_FOUND = new AppError('SPEC_ID_NOT_FOUND', 'No saved Spec ID has this code. Check it, or build and save it.');
const NEW_ID = '00000000-0000-4000-8000-000000000007';

/** Where a save lands: the id it opened, and the message it left. */
function Landed() {
  const { id } = useParams();
  const notice = (useLocation().state as SavedNotice | null)?.notice;
  return <p>{`Opened ${id}: ${notice}`}</p>;
}

function renderForm(overrides: Partial<AtlasGateway> = {}, dictionary: AtlasDictionary = testDictionary) {
  const gateway = gatewayWith({
    encode: async () => readCode(ILLUSTRATIVE),
    findByCode: async () => Promise.reject(NOT_FOUND),
    findSimilar: async () => ({ fits: [], mightFit: [] }),
    ...overrides,
  });
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  render(
    <QueryClientProvider client={queryClient}>
      <AtlasGatewayProvider gateway={gateway}>
        <MemoryRouter initialEntries={['/atlas/new']}>
          <Routes>
            <Route path="/atlas/new" element={<NewSpecIdForm dictionary={dictionary} seed={null} timeZone="UTC" />} />
            <Route path="/atlas/:id" element={<Landed />} />
          </Routes>
        </MemoryRouter>
      </AtlasGatewayProvider>
    </QueryClientProvider>,
  );
  return gateway;
}

const saveButton = () => screen.getByRole('button', { name: 'Save Spec ID' }) as HTMLButtonElement;

describe('NewSpecIdForm', () => {
  it('names and saves the Spec ID, then opens it with the saved message', async () => {
    const save = vi.fn<AtlasGateway['save']>(async ({ name }) => savedFor(ILLUSTRATIVE, name, { id: NEW_ID }));
    renderForm({ save });
    await waitFor(() => expect(saveButton().disabled).toBe(false));

    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Illustrative lid' } });
    fireEvent.click(saveButton());

    expect(await screen.findByText(`Opened ${NEW_ID}: Saved ${ILLUSTRATIVE} as "Illustrative lid".`)).toBeTruthy();
    expect(save).toHaveBeenCalledWith({ name: 'Illustrative lid', facts: { productType: 'BLD' } });
  });

  it('opens the saved Spec ID at once, without waiting for the lookups to be asked again', async () => {
    let asked = 0;
    // The first check finds nothing; once saved, every check waits forever.
    const findByCode = vi.fn<AtlasGateway['findByCode']>(() =>
      asked++ === 0 ? Promise.reject(NOT_FOUND) : new Promise(() => undefined),
    );
    renderForm({ findByCode, save: async ({ name }) => savedFor(ILLUSTRATIVE, name, { id: NEW_ID }) });
    await waitFor(() => expect(saveButton().disabled).toBe(false));

    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Illustrative lid' } });
    fireEvent.click(saveButton());

    expect(await screen.findByText(`Opened ${NEW_ID}: Saved ${ILLUSTRATIVE} as "Illustrative lid".`)).toBeTruthy();
    expect(findByCode).toHaveBeenCalledTimes(2);
  });

  it('cannot save while another saved Spec ID has the code, and says why', async () => {
    renderForm({ findByCode: async () => lookupFor(ILLUSTRATIVE, 'Illustrative lid') });

    expect(await screen.findByText('This code is already saved. Open it to add or correct facts instead.')).toBeTruthy();
    expect(saveButton().disabled).toBe(true);
    expect(screen.getByRole('region', { name: 'Already saved' })).toBeTruthy();
  });

  it('does not count a Spec ID that only once had the code as a match', async () => {
    renderForm({ findByCode: async () => lookupFor(ILLUSTRATIVE.replace('.0090.', '.0091.'), 'Moved', { replacedCode: ILLUSTRATIVE }) });

    await waitFor(() => expect(saveButton().disabled).toBe(false));
    expect(screen.queryByRole('region', { name: 'Already saved' })).toBeNull();
  });

  it('says who saved the code first when the server refuses a duplicate, with Open', async () => {
    const existing = savedFor(ILLUSTRATIVE, 'First lid', { id: '00000000-0000-4000-8000-000000000009' });
    renderForm({
      save: async () => Promise.reject(new SpecIdExistsError(existing, 'This Spec ID already exists.')),
    });
    await waitFor(() => expect(saveButton().disabled).toBe(false));

    fireEvent.click(saveButton());

    const sentence = await screen.findByText(
      'This Spec ID already exists, saved as "First lid" by Ada Invented on 16 October 2026. Nothing new was saved.',
    );
    const outcome = sentence.closest('[role="status"]') as HTMLElement;
    expect(within(outcome).getByRole('link', { name: 'Open' }).getAttribute('href')).toBe(`/atlas/${existing.id}`);
  });

  it('puts a refused name beside the Name field', async () => {
    renderForm({
      save: async () =>
        Promise.reject(new AppError('INVALID_SPEC_ID', 'The Spec ID is not valid.', { name: ['Name is required.'] })),
    });
    await waitFor(() => expect(saveButton().disabled).toBe(false));

    fireEvent.click(saveButton());

    expect(await screen.findByText('Name is required.')).toBeTruthy();
    expect(screen.queryByRole('alert')).toBeNull();
  });
});

describe('NewSpecIdForm, the S2 slots', () => {
  it('starts on the first product type in the list, a bowl lid, A1', async () => {
    const encode = vi.fn<AtlasGateway['encode']>(async () => readCode(ILLUSTRATIVE));
    renderForm({ encode }, s2Dictionary);

    expect((screen.getByLabelText('Product type') as HTMLSelectElement).value).toBe('1');
    await waitFor(() => expect(encode).toHaveBeenLastCalledWith({ productType: '1' }));
  });

  // Each option by its key, its number (ADR 0033): a cup is 5, double wall 2, 2 colours 3.
  it.each([
    ['Wall', '5', '2', { wall: '2' }],
    ['Print', '5', '3', { print: '3' }],
    ['Compartments', '3', '03', { compartments: '3' }],
    ['Plies', '17', '2', { plies: '2' }],
    ['Lid opening', '2', '2', { lidOpening: '2' }],
    ['Handle', '16', '2', { handle: '2' }],
    ['Individual wrap', '24', '2', { wrap: '2' }],
    ['Window', '12', '2', { window: '2' }],
  ])('asks for a new code once %s is given', async (label, productType, value, fact) => {
    const encode = vi.fn<AtlasGateway['encode']>(async () => readCode(ILLUSTRATIVE));
    renderForm({ encode }, s2Dictionary);

    fireEvent.change(screen.getByLabelText('Product type'), { target: { value: productType } });
    fireEvent.change(screen.getByLabelText(label), { target: { value } });

    await waitFor(() => expect(encode).toHaveBeenLastCalledWith({ productType, ...fact }));
  });
});
