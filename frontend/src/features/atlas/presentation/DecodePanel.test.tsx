import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { AppError } from '@/shared/application/app-error';
import type { AtlasGateway } from '../application/atlas-gateway';
import { AtlasGatewayProvider } from '../application/atlas-gateway-context';
import { SLOT_NAMES, type DecodedSpecId } from '../domain/atlas';
import { DecodePanel } from './DecodePanel';

const ILLUSTRATIVE = 'S1.BLD.APS.00.CL.RD.DM.XXXXX.0090.XXXX.0000.XXXX.XXXX.XXXX.0033.XXX.000.XX';
const MEANINGS = [
  'S1',
  'Bowl lid',
  'Polymer, PS (polystyrene)',
  'Not known',
  'Clear',
  'Round',
  'Dome',
  "Doesn't apply",
  '90 mm',
  "Doesn't apply",
  'Not known',
  "Doesn't apply",
  "Doesn't apply",
  "Doesn't apply",
  '3.3 g',
  "Doesn't apply",
  'Not known',
  "Doesn't apply",
];

const decoded: DecodedSpecId = {
  code: ILLUSTRATIVE,
  dictionaryRelease: 'S1 0.1.0',
  slots: SLOT_NAMES.map((slot, index) => {
    const raw = ILLUSTRATIVE.split('.')[index] ?? '';
    const meaning = MEANINGS[index] ?? '';
    const state = meaning === 'Not known' ? 'not-known' : meaning === "Doesn't apply" ? 'does-not-apply' : 'value';
    return { number: index + 1, key: slot.key, name: slot.name, raw, state, meaning };
  }),
};

function renderPanel(decode: AtlasGateway['decode']) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  const pending = () => new Promise<never>(() => undefined);
  const gateway: AtlasGateway = {
    dictionary: pending,
    decode,
    encode: pending,
    save: pending,
    findByCode: pending,
    findSimilar: pending,
  };
  render(
    <QueryClientProvider client={queryClient}>
      <AtlasGatewayProvider gateway={gateway}>
        <DecodePanel />
      </AtlasGatewayProvider>
    </QueryClientProvider>,
  );
}

function decodeCode(code: string) {
  fireEvent.change(screen.getByLabelText('Spec ID'), { target: { value: code } });
  fireEvent.click(screen.getByRole('button', { name: 'Decode' }));
}

describe('DecodePanel', () => {
  it('shows nothing under the form before a decode', () => {
    renderPanel(vi.fn());
    expect(screen.queryByRole('table')).toBeNull();
  });

  it('reads the illustrative code into 18 rows', async () => {
    const decode = vi.fn(async () => decoded);
    renderPanel(decode);
    decodeCode(ILLUSTRATIVE);

    const table = await screen.findByRole('table');
    expect(decode).toHaveBeenCalledWith(ILLUSTRATIVE);
    expect(within(table).getAllByRole('row')).toHaveLength(19);
    expect(within(table).getByText('Bowl lid')).toBeTruthy();
    expect(within(table).getByText('90 mm')).toBeTruthy();
    expect(within(table).getByRole('columnheader', { name: 'Meaning' })).toBeTruthy();
  });

  it("shows each slot message in that slot's row", async () => {
    const message = 'Top diameter: 0X90 mixes a marker with other characters.';
    renderPanel(async () => {
      throw new AppError('INVALID_SPEC_ID', 'The Spec ID is not valid.', { topDiameter: [message] });
    });
    decodeCode(ILLUSTRATIVE.replace('.0090.', '.0X90.'));

    const row = await screen.findByRole('row', { name: /Top diameter/ });
    expect(within(row).getByText(message)).toBeTruthy();
    expect(within(row).getByText('0X90')).toBeTruthy();
    expect(screen.getAllByRole('row')).toHaveLength(19);
  });

  it('announces each slot message, since it sits under no input', async () => {
    const message = 'Top diameter: 0X90 mixes a marker with other characters.';
    renderPanel(async () => {
      throw new AppError('INVALID_SPEC_ID', 'The Spec ID is not valid.', { topDiameter: [message] });
    });
    decodeCode(ILLUSTRATIVE.replace('.0090.', '.0X90.'));

    expect((await screen.findByRole('alert')).textContent).toBe(message);
  });

  it('shows problems with the whole code under the input, and no table when it is not 18 parts', async () => {
    const message = 'A Spec ID is 74 characters. This one has 6.';
    renderPanel(async () => {
      throw new AppError('INVALID_SPEC_ID', 'The Spec ID is not valid.', { code: [message] });
    });
    decodeCode('S1.BLD');

    expect(await screen.findByText(message)).toBeTruthy();
    expect(screen.getByLabelText('Spec ID').getAttribute('aria-invalid')).toBe('true');
    expect(screen.queryByRole('table')).toBeNull();
  });

  it('asks the server even when the box is empty', async () => {
    const decode = vi.fn(async (): Promise<DecodedSpecId> => {
      throw new AppError('INVALID_SPEC_ID', 'The Spec ID is not valid.', { code: ['Paste a Spec ID to read it.'] });
    });
    renderPanel(decode);
    fireEvent.click(screen.getByRole('button', { name: 'Decode' }));

    expect(await screen.findByText('Paste a Spec ID to read it.')).toBeTruthy();
    expect(decode).toHaveBeenCalledWith('');
  });

  it('shows any other failure with Try again, which sends the same code again', async () => {
    const decode = vi
      .fn<AtlasGateway['decode']>()
      .mockRejectedValueOnce(new AppError('NETWORK', 'Cannot reach the server. Check your connection and try again.'))
      .mockResolvedValue(decoded);
    renderPanel(decode);
    decodeCode(ILLUSTRATIVE);

    expect(await screen.findByText('Cannot reach the server. Check your connection and try again.')).toBeTruthy();
    fireEvent.change(screen.getByLabelText('Spec ID'), { target: { value: 'something else' } });
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));

    expect(await screen.findByRole('table')).toBeTruthy();
    await waitFor(() => expect(decode).toHaveBeenCalledTimes(2));
    expect(decode).toHaveBeenLastCalledWith(ILLUSTRATIVE);
  });
});
