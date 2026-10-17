import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import type { AtlasGateway } from '../application/atlas-gateway';
import { AtlasGatewayProvider } from '../application/atlas-gateway-context';
import { SpecIdChangedError } from '../application/spec-id-changed-error';
import { SpecIdExistsError } from '../application/spec-id-exists-error';
import {
  gatewayWith,
  ILLUSTRATIVE,
  lookupFor,
  readCode,
  savedFor,
  testDictionary,
} from '../application/testing/atlas-fixtures';
import type { SavedSpecId } from '../domain/atlas';
import { SpecIdEditor } from './SpecIdEditor';

const ID = '00000000-0000-4000-8000-000000000001';
const WITH_HEIGHT = ILLUSTRATIVE.replace('.0000.', '.0062.');
const ben = { id: '00000000-0000-4000-8000-0000000000bb', fullName: 'Ben Invented' };

/** The illustrative lid as saved: three slots not known. */
function saved(code = ILLUSTRATIVE, overrides: Partial<SavedSpecId> = {}): SavedSpecId {
  return { ...savedFor(code, 'Illustrative lid', { id: ID }), slots: readCode(code).slots, ...overrides };
}

function renderEditor(
  overrides: Partial<AtlasGateway> = {},
  { onReload = async () => null, notice }: { onReload?: () => Promise<SavedSpecId | null>; notice?: string } = {},
) {
  const gateway = gatewayWith({
    encode: async () => readCode(ILLUSTRATIVE),
    findByCode: async () => lookupFor(ILLUSTRATIVE, 'Illustrative lid', { id: ID }),
    findSimilar: async () => ({ fits: [], mightFit: [] }),
    ...overrides,
  });
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  render(
    <QueryClientProvider client={queryClient}>
      <AtlasGatewayProvider gateway={gateway}>
        <MemoryRouter>
          <SpecIdEditor dictionary={testDictionary} saved={saved()} onReload={onReload} notice={notice} timeZone="UTC" />
        </MemoryRouter>
      </AtlasGatewayProvider>
    </QueryClientProvider>,
  );
  return gateway;
}

const saveChanges = () => screen.getByRole('button', { name: 'Save changes' }) as HTMLButtonElement;
const type = (label: string, value: string) => fireEvent.change(screen.getByLabelText(label), { target: { value } });

describe('SpecIdEditor, the header', () => {
  it('shows the way back, the name, how many slots are not known, and who changed it', () => {
    renderEditor();
    expect(screen.getByRole('link', { name: 'Atlas' }).getAttribute('href')).toBe('/atlas');
    expect(screen.getByRole('heading', { level: 1, name: 'Illustrative lid' })).toBeTruthy();
    expect(screen.getByText('3 not known')).toBeTruthy();
    expect(
      screen.getByText('Last updated by Ada Invented on 16 October 2026 · created by Ada Invented on 16 October 2026'),
    ).toBeTruthy();
  });

  it('shows the message a save on /atlas/new left', () => {
    renderEditor({}, { notice: `Saved ${ILLUSTRATIVE} as "Illustrative lid".` });
    expect(screen.getByRole('status').textContent).toBe(`Saved ${ILLUSTRATIVE} as "Illustrative lid".`);
  });

  it('never shows its own code as already saved', async () => {
    const gateway = renderEditor({ findByCode: vi.fn(async () => lookupFor(ILLUSTRATIVE, 'Illustrative lid', { id: ID })) });
    await waitFor(() => expect(gateway.findByCode).toHaveBeenCalledWith(ILLUSTRATIVE));
    expect(screen.queryByRole('region', { name: 'Already saved' })).toBeNull();
  });
});

describe('SpecIdEditor, Save changes', () => {
  it('waits for a change, and waits again after the change is undone', () => {
    renderEditor();
    expect(saveChanges().disabled).toBe(true);

    type('Height', '62');
    expect(saveChanges().disabled).toBe(false);

    type('Height', '');
    expect(saveChanges().disabled).toBe(true);
  });

  it('sends the version it started from, and says the new code', async () => {
    const update = vi.fn<AtlasGateway['update']>(async () =>
      saved(WITH_HEIGHT, { version: 2, updatedBy: ben, updatedAt: new Date('2026-10-17T14:32:00Z') }),
    );
    renderEditor({ update });

    type('Height', '62');
    fireEvent.click(saveChanges());

    expect(await screen.findByText(`Saved. The code is now ${WITH_HEIGHT}.`)).toBeTruthy();
    expect(update).toHaveBeenCalledWith(ID, expect.objectContaining({ name: 'Illustrative lid', version: 1 }));
    expect(update.mock.calls[0]?.[1].facts.height).toEqual({ value: '62', unit: 'mm' });
    expect(screen.getByText('2 not known')).toBeTruthy();
    expect(
      screen.getByText('Last updated by Ben Invented on 17 October 2026 · created by Ada Invented on 16 October 2026'),
    ).toBeTruthy();
    expect(saveChanges().disabled).toBe(true);
  });

  it('is done as soon as the save is, without waiting for the history and lookups to be asked again', async () => {
    let asked = 0;
    // The first check answers; once saved, every check waits forever.
    const findByCode = vi.fn<AtlasGateway['findByCode']>(async () =>
      asked++ === 0 ? lookupFor(ILLUSTRATIVE, 'Illustrative lid', { id: ID }) : new Promise<never>(() => undefined),
    );
    renderEditor({ findByCode, update: async () => saved(ILLUSTRATIVE, { name: 'Big lid', version: 2 }) });
    await waitFor(() => expect(findByCode).toHaveBeenCalledTimes(1));

    type('Name', 'Big lid');
    fireEvent.click(saveChanges());

    expect(await screen.findByText('Saved.')).toBeTruthy();
    expect(findByCode).toHaveBeenCalledTimes(2);
  });

  it('says only "Saved." when the code did not change', async () => {
    renderEditor({ update: async () => saved(ILLUSTRATIVE, { name: 'Big lid', version: 2 }) });

    type('Name', 'Big lid');
    fireEvent.click(saveChanges());

    expect(await screen.findByText('Saved.')).toBeTruthy();
    expect(screen.getByRole('heading', { level: 1, name: 'Big lid' })).toBeTruthy();
  });

  it("refuses another product's code, with the way to it", async () => {
    const existing = savedFor(WITH_HEIGHT, 'Tall lid', { id: '00000000-0000-4000-8000-000000000009' });
    renderEditor({ update: async () => Promise.reject(new SpecIdExistsError(existing, 'This Spec ID already exists.')) });

    type('Height', '62');
    fireEvent.click(saveChanges());

    const sentence = await screen.findByText(
      'This change gives it the same code as "Tall lid", which is already saved. Open that one instead, or change a fact.',
    );
    const outcome = sentence.closest('[role="status"]') as HTMLElement;
    expect(within(outcome).getByRole('link', { name: 'Open' }).getAttribute('href')).toBe(`/atlas/${existing.id}`);
  });

  it('refuses a change someone saved first, and Reload starts again from theirs', async () => {
    const theirs = saved(WITH_HEIGHT, { name: 'Lid, measured', version: 2, updatedBy: ben, updatedAt: new Date('2026-10-17T14:32:00Z') });
    const onReload = vi.fn(async () => theirs);
    renderEditor(
      { update: async () => Promise.reject(new SpecIdChangedError('Someone changed this Spec ID.')) },
      { onReload },
    );

    type('Height', '70');
    fireEvent.click(saveChanges());
    expect(
      await screen.findByText(
        'Someone changed this Spec ID while you were editing. Reload to see their changes, then make yours again.',
      ),
    ).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Reload' }));

    expect(await screen.findByRole('heading', { level: 1, name: 'Lid, measured' })).toBeTruthy();
    expect((screen.getByLabelText('Height') as HTMLInputElement).value).toBe('62');
    expect(saveChanges().disabled).toBe(true);
    expect(screen.queryByText(/Someone changed this Spec ID/)).toBeNull();
  });
});

describe('SpecIdEditor, History', () => {
  it('opens the History panel from the header, asking for the history only then', async () => {
    const history = vi.fn<AtlasGateway['history']>(async () => []);
    renderEditor({ history });
    expect(history).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'History' }));

    expect(await screen.findByRole('dialog', { name: 'History' })).toBeTruthy();
    expect(screen.getByText('Every change to Illustrative lid, newest first.')).toBeTruthy();
    expect(history).toHaveBeenCalledWith(ID);
  });
});
