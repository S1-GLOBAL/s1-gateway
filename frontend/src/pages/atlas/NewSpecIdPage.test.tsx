import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { RouteBoundary } from '@/app/shell/RouteBoundary';
import { AtlasGatewayProvider, type AtlasDictionary, type AtlasGateway, type DecodedSpecId } from '@/features/atlas';
import { AppError } from '@/shared/application/app-error';
import { NewSpecIdPage } from './NewSpecIdPage';
import { NewSpecIdPageSkeleton } from './NewSpecIdPageSkeleton';

const dictionary: AtlasDictionary = {
  release: 'S1 0.1.0',
  approvedOn: '2026-10-16',
  slots: [
    { key: 'productType', name: 'Product type', values: [{ code: 'BLD', meaning: 'Bowl lid' }] },
    {
      key: 'material',
      name: 'Material',
      values: [
        { code: 'APS', meaning: 'Polymer, PS (polystyrene)' },
        { code: 'BKR', meaning: 'Paper and paperboard, kraft' },
      ],
    },
  ],
  rules: [],
};

const CODE = 'S1.BLD.APS';
const decoded: DecodedSpecId = {
  code: CODE,
  dictionaryRelease: 'S1 0.1.0',
  slots: [
    { number: 2, key: 'productType', name: 'Product type', raw: 'BLD', state: 'value', meaning: 'Bowl lid' },
    { number: 3, key: 'material', name: 'Material', raw: 'APS', state: 'value', meaning: 'Polymer, PS (polystyrene)' },
  ],
};

function renderAt(path: string, overrides: Partial<AtlasGateway> = {}) {
  const pending = () => new Promise<never>(() => undefined);
  const gateway: AtlasGateway = {
    dictionary: async () => dictionary,
    decode: pending,
    encode: pending,
    save: pending,
    findByCode: pending,
    findSimilar: pending,
    getSaved: pending,
    update: pending,
    history: pending,
    ...overrides,
  };
  const router = createMemoryRouter(
    [
      {
        path: '/atlas/new',
        element: (
          <RouteBoundary skeleton={<NewSpecIdPageSkeleton />}>
            <NewSpecIdPage />
          </RouteBoundary>
        ),
      },
    ],
    { initialEntries: [path] },
  );
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <AtlasGatewayProvider gateway={gateway}>
        <RouterProvider router={router} />
      </AtlasGatewayProvider>
    </QueryClientProvider>,
  );
  return gateway;
}

const material = () => screen.getByLabelText('Material') as HTMLSelectElement;

describe('NewSpecIdPage', () => {
  it('shows its skeleton while the dictionary loads', () => {
    renderAt('/atlas/new', { dictionary: () => new Promise(() => undefined) });
    expect(screen.getByRole('status', { name: 'Loading New Spec ID' })).toBeTruthy();
  });

  it('starts empty, with the way back and what to do', async () => {
    const decode = vi.fn<AtlasGateway['decode']>();
    renderAt('/atlas/new', { decode });
    expect(await screen.findByRole('heading', { level: 1, name: 'New Spec ID' })).toBeTruthy();
    expect(
      screen.getByText('Fill in what you know. Anything you leave empty stays "not known" and can be added later.'),
    ).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Atlas' }).getAttribute('href')).toBe('/atlas');
    expect(material().value).toBe('');
    expect(decode).not.toHaveBeenCalled();
  });

  it('starts from the facts of ?code=', async () => {
    const encode = vi.fn<AtlasGateway['encode']>(() => new Promise(() => undefined));
    renderAt(`/atlas/new?code=${CODE}`, { decode: async () => decoded, encode });
    await screen.findByRole('heading', { level: 1, name: 'New Spec ID' });
    expect(material().value).toBe('APS');
    await waitFor(() => expect(encode).toHaveBeenCalledWith({ productType: 'BLD', material: 'APS' }));
  });

  it('starts empty from a code that cannot be read', async () => {
    renderAt('/atlas/new?code=nonsense', {
      decode: async () => Promise.reject(new AppError('INVALID_SPEC_ID', 'The Spec ID is not valid.')),
    });
    await screen.findByRole('heading', { level: 1, name: 'New Spec ID' });
    expect(material().value).toBe('');
  });
});
