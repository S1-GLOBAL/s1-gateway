import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { AppError } from '@/shared/application/app-error';
import type { AtlasGateway } from '../application/atlas-gateway';
import { AtlasGatewayProvider } from '../application/atlas-gateway-context';
import { SpecIdExistsError } from '../application/spec-id-exists-error';
import { decodedFor, gatewayWith, ILLUSTRATIVE, savedFor, testDictionary } from '../application/testing/atlas-fixtures';
import { BuildPanel } from './BuildPanel';

function renderPanel(overrides: Partial<AtlasGateway> = {}) {
  const gateway = gatewayWith({ encode: vi.fn(async () => decodedFor(ILLUSTRATIVE)), ...overrides });
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  render(
    <QueryClientProvider client={queryClient}>
      <AtlasGatewayProvider gateway={gateway}>
        <BuildPanel dictionary={testDictionary} timeZone="UTC" />
      </AtlasGatewayProvider>
    </QueryClientProvider>,
  );
  return gateway;
}

const choose = (label: string, value: string) =>
  fireEvent.change(screen.getByLabelText(label), { target: { value } });
const type = (label: string, value: string) => fireEvent.change(screen.getByLabelText(label), { target: { value } });

/** The illustrative lid: the choices that make `ILLUSTRATIVE`. */
function chooseIllustrative() {
  choose('Material', 'APS');
  choose('Colour / clarity', 'CL');
  choose('Shape', 'RD');
  choose('Profile', 'DM');
  type('Top diameter', '90');
  type('Unit weight', '3.3');
}

const select = (label: string) => screen.getByLabelText(label) as HTMLSelectElement;
const optionTexts = (label: string) =>
  within(select(label)).getAllByRole('option').map((option) => option.textContent);

describe('BuildPanel', () => {
  it('starts as a bowl lid, with the slots a bowl lid never has locked at "Doesn\'t apply"', () => {
    renderPanel();

    expect(select('Product type').value).toBe('BLD');
    expect(optionTexts('Product type')).toEqual(['BLD — Bowl lid', 'BWL — Bowl']);
    for (const label of ['Nominal capacity', 'Bottom diameter', 'Gusset']) {
      expect(select(label).disabled).toBe(true);
      expect(optionTexts(label)).toEqual(["Doesn't apply"]);
    }
  });

  it('offers every other dictionary slot as Not known, then its values', () => {
    renderPanel();
    expect(optionTexts('Shape')).toEqual(['Not known', 'RD — Round', 'SQ — Square']);
    expect(select('Shape').value).toBe('');
  });

  it('locks Profile at "Doesn\'t apply" and unlocks Nominal capacity for a bowl', () => {
    renderPanel();
    choose('Product type', 'BWL');

    expect(select('Profile').disabled).toBe(true);
    expect(optionTexts('Profile')).toEqual(["Doesn't apply"]);
    expect(select('Nominal capacity').disabled).toBe(false);
    expect(optionTexts('Nominal capacity')).toEqual(['Not known', 'Z — Ounces', 'M — Millilitres']);
  });

  it('keeps the capacity amount locked until a unit is chosen', () => {
    renderPanel();
    choose('Product type', 'BWL');
    expect((screen.getByLabelText('Nominal capacity amount') as HTMLInputElement).disabled).toBe(true);

    choose('Nominal capacity', 'Z');
    expect((screen.getByLabelText('Nominal capacity amount') as HTMLInputElement).disabled).toBe(false);
  });

  it('locks Top diameter at "Not known" while the shape is not known', () => {
    renderPanel();

    expect(select('Top diameter').disabled).toBe(true);
    expect(optionTexts('Top diameter')).toEqual(['Not known']);

    choose('Shape', 'RD');
    expect((screen.getByLabelText('Top diameter') as HTMLInputElement).disabled).toBe(false);
    expect(select('Top diameter unit').value).toBe('mm');
    expect(optionTexts('Top diameter unit')).toEqual(['mm', 'cm', 'in']);
  });

  it('offers micrometres for thickness and sends them as um', async () => {
    const encode = vi.fn(async () => decodedFor(ILLUSTRATIVE));
    renderPanel({ encode });
    type('Thickness', '50');

    expect(optionTexts('Thickness unit')).toEqual(['µm']);
    await waitFor(() =>
      expect(encode).toHaveBeenLastCalledWith({ productType: 'BLD', thickness: { value: '50', unit: 'um' } }),
    );
  });

  it('shows the illustrative code for the illustrative choices', async () => {
    const encode = vi.fn(async () => decodedFor(ILLUSTRATIVE));
    renderPanel({ encode });
    chooseIllustrative();

    expect(await screen.findByText(ILLUSTRATIVE)).toBeTruthy();
    await waitFor(() =>
      expect(encode).toHaveBeenLastCalledWith({
        productType: 'BLD',
        material: 'APS',
        colourClarity: 'CL',
        shape: 'RD',
        profile: 'DM',
        topDiameter: { value: '90', unit: 'mm' },
        unitWeight: { value: '3.3', unit: 'g' },
      }),
    );
  });

  it('sends no value for a slot that locks, and keeps what was typed for when it unlocks', async () => {
    const encode = vi.fn(async () => decodedFor(ILLUSTRATIVE));
    renderPanel({ encode });
    choose('Product type', 'BWL');
    type('Bottom diameter', '60');
    await waitFor(() =>
      expect(encode).toHaveBeenLastCalledWith({ productType: 'BWL', bottomDiameter: { value: '60', unit: 'mm' } }),
    );

    choose('Product type', 'BLD');
    expect(select('Bottom diameter').disabled).toBe(true);
    await waitFor(() => expect(encode).toHaveBeenLastCalledWith({ productType: 'BLD' }));

    choose('Product type', 'BWL');
    expect((screen.getByLabelText('Bottom diameter') as HTMLInputElement).value).toBe('60');
  });

  it("shows the server's messages beside their controls, and no code", async () => {
    const message = 'Top diameter: 12000 mm is outside 1–9999 mm.';
    renderPanel({
      encode: async () => {
        throw new AppError('INVALID_SPEC_ID', 'The Spec ID is not valid.', { topDiameter: [message] });
      },
    });
    choose('Shape', 'RD');
    type('Top diameter', '12000');

    expect(await screen.findByText(message)).toBeTruthy();
    expect(screen.getByLabelText('Top diameter').getAttribute('aria-invalid')).toBe('true');
    expect(screen.queryByText(ILLUSTRATIVE)).toBeNull();
  });

  it('saves under the name and says so', async () => {
    const save = vi.fn(async () => savedFor(ILLUSTRATIVE, 'Illustrative lid'));
    renderPanel({ save });
    chooseIllustrative();
    await screen.findByText(ILLUSTRATIVE);
    type('Name', 'Illustrative lid');
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    const status = await screen.findByRole('status');
    expect(status.textContent).toBe(`Saved ${ILLUSTRATIVE} as "Illustrative lid".`);
    expect(save).toHaveBeenCalledWith({
      name: 'Illustrative lid',
      facts: expect.objectContaining({ productType: 'BLD', topDiameter: { value: '90', unit: 'mm' } }),
    });
  });

  it('shows the Spec ID already saved, who saved it and when, for a duplicate', async () => {
    const existing = savedFor(ILLUSTRATIVE, 'Illustrative lid');
    renderPanel({
      save: async () => {
        throw new SpecIdExistsError(existing, 'This Spec ID already exists. Nothing new was saved.');
      },
    });
    chooseIllustrative();
    type('Name', 'Second try');
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    expect(
      await screen.findByText(
        'This Spec ID already exists, saved as "Illustrative lid" by Ada Invented on 16 October 2026. Nothing new was saved.',
      ),
    ).toBeTruthy();
    const card = screen.getByRole('article', { name: 'Illustrative lid' });
    expect(within(card).getByText(ILLUSTRATIVE)).toBeTruthy();
    expect(within(card).getByText('Ada Invented · 16 October 2026')).toBeTruthy();
    expect(within(card).getAllByRole('row')).toHaveLength(19);
  });

  it('asks the person to sign in when the session has ended', async () => {
    renderPanel({
      save: async () => {
        throw new AppError('SIGN_IN_REQUIRED', 'Your session ended. Sign in again.');
      },
    });
    type('Name', 'Illustrative lid');
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    expect((await screen.findByRole('alert')).textContent).toBe('Sign in to save Spec IDs.');
  });

  it('shows a name problem under the Name field', async () => {
    renderPanel({
      save: async () => {
        throw new AppError('INVALID_SPEC_ID', 'The Spec ID is not valid.', { name: ['Name is required.'] });
      },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    expect(await screen.findByText('Name is required.')).toBeTruthy();
    expect(screen.getByLabelText('Name').getAttribute('aria-invalid')).toBe('true');
    expect(screen.queryByText('Up to 120 characters.')).toBeNull();
  });

  it('shows the name hint until there is a problem', () => {
    renderPanel();
    expect(screen.getByText('Up to 120 characters.')).toBeTruthy();
  });

  it("shows any other failure's message", async () => {
    renderPanel({
      save: async () => {
        throw new AppError('NETWORK', 'Cannot reach the server. Check your connection and try again.');
      },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    expect((await screen.findByRole('alert')).textContent).toBe(
      'Cannot reach the server. Check your connection and try again.',
    );
  });

  it('forgets the last save once the form changes', async () => {
    renderPanel({ save: async () => savedFor(ILLUSTRATIVE, 'Illustrative lid') });
    type('Name', 'Illustrative lid');
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    await screen.findByRole('status');

    choose('Material', 'APS');
    await waitFor(() => expect(screen.queryByRole('status')).toBeNull());
  });
});
