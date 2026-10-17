import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { AppError } from '@/shared/application/app-error';
import type { AtlasGateway } from '../application/atlas-gateway';
import { AtlasGatewayProvider } from '../application/atlas-gateway-context';
import { gatewayWith, ILLUSTRATIVE, lookupFor, testDictionary } from '../application/testing/atlas-fixtures';
import { LookupPanel } from './LookupPanel';

const NO_FITS = { fits: [], mightFit: [] };

function renderPanel(overrides: Partial<AtlasGateway> = {}) {
  const gateway = gatewayWith({ findSimilar: vi.fn(async () => NO_FITS), ...overrides });
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  render(
    <QueryClientProvider client={queryClient}>
      <AtlasGatewayProvider gateway={gateway}>
        <LookupPanel dictionary={testDictionary} timeZone="UTC" />
      </AtlasGatewayProvider>
    </QueryClientProvider>,
  );
  return gateway;
}

const set = (label: string, value: string) => fireEvent.change(screen.getByLabelText(label), { target: { value } });
const press = (name: string) => fireEvent.click(screen.getByRole('button', { name }));
const select = (label: string) => screen.getByLabelText(label) as HTMLSelectElement;

describe('LookupPanel, exact code', () => {
  it('opens the saved Spec ID with its saver, date and 18 slots', async () => {
    const findByCode = vi.fn(async () => lookupFor(ILLUSTRATIVE, 'Illustrative lid'));
    renderPanel({ findByCode });
    set('Exact code', ` ${ILLUSTRATIVE} `);
    press('Find');

    const card = await screen.findByRole('article', { name: 'Illustrative lid' });
    expect(findByCode).toHaveBeenCalledWith(ILLUSTRATIVE);
    expect(within(card).getByText('Ada Invented · 16 October 2026')).toBeTruthy();
    expect(within(card).getAllByRole('row')).toHaveLength(19);
  });

  it('says so when no saved Spec ID has the code', async () => {
    const sentence = 'No saved Spec ID has this code. Check it, or build and save it.';
    renderPanel({
      findByCode: async () => {
        throw new AppError('SPEC_ID_NOT_FOUND', sentence);
      },
    });
    set('Exact code', ILLUSTRATIVE);
    press('Find');

    expect(await screen.findByText(sentence)).toBeTruthy();
    expect(screen.getAllByRole('status').map((status) => status.textContent)).toContain(sentence);
    expect(screen.queryByRole('article')).toBeNull();
  });

  it('shows any other failure with Try again, which asks for the same code again', async () => {
    const findByCode = vi
      .fn<AtlasGateway['findByCode']>()
      .mockRejectedValueOnce(new AppError('NETWORK', 'Cannot reach the server. Check your connection and try again.'))
      .mockResolvedValue(lookupFor(ILLUSTRATIVE, 'Illustrative lid'));
    renderPanel({ findByCode });
    set('Exact code', ILLUSTRATIVE);
    press('Find');

    expect(await screen.findByText('Cannot reach the server. Check your connection and try again.')).toBeTruthy();
    set('Exact code', 'something else');
    press('Try again');

    expect(await screen.findByRole('article', { name: 'Illustrative lid' })).toBeTruthy();
    expect(findByCode).toHaveBeenLastCalledWith(ILLUSTRATIVE);
  });

  it('cannot be pressed with nothing typed, which would ask for the whole list', () => {
    const findByCode = vi.fn();
    renderPanel({ findByCode });

    expect((screen.getByRole('button', { name: 'Find' }) as HTMLButtonElement).disabled).toBe(true);
    set('Exact code', '   ');
    expect((screen.getByRole('button', { name: 'Find' }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.submit(screen.getByLabelText('Exact code'));
    expect(findByCode).not.toHaveBeenCalled();
  });
});

describe('LookupPanel, similar', () => {
  it('looks up once on load with no slot chosen, and every control starts at Any', async () => {
    const findSimilar = vi.fn(async () => NO_FITS);
    renderPanel({ findSimilar });

    await waitFor(() => expect(findSimilar).toHaveBeenCalledWith({}));
    expect(screen.getByRole('heading', { level: 3, name: 'Similar' })).toBeTruthy();
    expect(select('Shape').value).toBe('');
    expect(within(select('Shape')).getAllByRole('option').map((option) => option.textContent)).toEqual([
      'Any',
      'RD — Round',
      'SQ — Square',
    ]);
    expect((screen.getByLabelText('Top diameter (mm)') as HTMLInputElement).value).toBe('');
  });

  it('labels each measure with the unit of its slot', () => {
    renderPanel();
    for (const label of [
      'Top diameter (mm)',
      'Bottom diameter (mm)',
      'Unit weight (g)',
      'Basis weight (gsm)',
      'Thickness (µm)',
    ]) {
      expect(screen.getByLabelText(label)).toBeTruthy();
    }
  });

  it('keeps the capacity amount locked until a unit is chosen', () => {
    renderPanel();
    expect((screen.getByLabelText('Nominal capacity amount') as HTMLInputElement).disabled).toBe(true);
    set('Nominal capacity', 'Z');
    expect((screen.getByLabelText('Nominal capacity amount') as HTMLInputElement).disabled).toBe(false);
  });

  it('sends the slots chosen as raw slot text, and lists what fits apart from what might', async () => {
    const fits = lookupFor(ILLUSTRATIVE, 'Rim 90');
    const might = lookupFor(ILLUSTRATIVE.replace('.0090.', '.0000.'), 'Unstated rim');
    const findSimilar = vi
      .fn<AtlasGateway['findSimilar']>()
      .mockResolvedValueOnce(NO_FITS)
      .mockResolvedValue({ fits: [fits], mightFit: [might] });
    renderPanel({ findSimilar });
    await screen.findByText('No Spec IDs saved yet. Build one above and save it.');
    set('Top diameter (mm)', '90');
    set('Shape', 'RD');
    set('Unit weight (g)', '3.3');
    set('Nominal capacity', 'Z');
    set('Nominal capacity amount', '6');
    press('Find similar');

    expect(await screen.findByRole('heading', { level: 4, name: 'Fits (1)' })).toBeTruthy();
    expect(screen.getByRole('heading', { level: 4, name: 'Might fit (1)' })).toBeTruthy();
    expect(findSimilar).toHaveBeenLastCalledWith({
      shape: 'RD',
      capacity: 'Z0006',
      topDiameter: '0090',
      unitWeight: '0033',
    });
    const items = screen.getAllByRole('listitem');
    expect(items).toHaveLength(2);
    expect(within(items[0]!).getByText('Rim 90')).toBeTruthy();
    expect(within(items[0]!).getByText(ILLUSTRATIVE)).toBeTruthy();
    expect(within(items[0]!).getByText('Ada Invented · 16 October 2026')).toBeTruthy();
    expect(within(items[1]!).getByText('Unstated rim')).toBeTruthy();
  });

  it('says nothing is saved yet when nothing was chosen and nothing was found', async () => {
    renderPanel();
    expect(await screen.findByText('No Spec IDs saved yet. Build one above and save it.')).toBeTruthy();
  });

  it('says no saved Spec ID fits when slots were chosen and nothing was found', async () => {
    renderPanel();
    await screen.findByText('No Spec IDs saved yet. Build one above and save it.');
    set('Top diameter (mm)', '91');
    press('Find similar');

    const sentence = 'No saved Spec IDs fit these choices. Set a slot back to Any to widen the search.';
    expect(await screen.findByText(sentence)).toBeTruthy();
    expect(screen.getByRole('status').textContent).toBe(sentence);
    expect(screen.queryByText('No Spec IDs saved yet. Build one above and save it.')).toBeNull();
  });

  it("shows the server's messages beside the controls they concern", async () => {
    const message = 'Top diameter: 12a is not a number.';
    renderPanel({
      findSimilar: vi
        .fn<AtlasGateway['findSimilar']>()
        .mockResolvedValueOnce(NO_FITS)
        .mockRejectedValue(new AppError('VALIDATION_FAILED', 'The lookup is not valid.', { topDiameter: [message] })),
    });
    await screen.findByText('No Spec IDs saved yet. Build one above and save it.');
    set('Top diameter (mm)', '12a');
    press('Find similar');

    expect(await screen.findByText(message)).toBeTruthy();
    expect(screen.getByLabelText('Top diameter (mm)').getAttribute('aria-invalid')).toBe('true');
  });

  it('shows any other failure with Try again', async () => {
    const findSimilar = vi
      .fn<AtlasGateway['findSimilar']>()
      .mockRejectedValueOnce(new AppError('NETWORK', 'Cannot reach the server. Check your connection and try again.'))
      .mockResolvedValue(NO_FITS);
    renderPanel({ findSimilar });

    expect(await screen.findByText('Cannot reach the server. Check your connection and try again.')).toBeTruthy();
    press('Try again');
    expect(await screen.findByText('No Spec IDs saved yet. Build one above and save it.')).toBeTruthy();
  });
});
