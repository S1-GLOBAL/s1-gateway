import { QueryClient, QueryClientProvider, useQuery } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import type { SpecIdManufacturer, SpecIdManufacturers } from '../domain/atlas';
import { AtlasGatewayProvider } from './atlas-gateway-context';
import { atlasKeys } from './atlas.keys';
import { gatewayWith } from './testing/atlas-fixtures';
import { useSetManufacturerStage } from './use-set-manufacturer-stage';

const SPEC = '00000000-0000-4000-8000-000000000001';
/** Invented: never a Source One manufacturer (ADR 0027). */
const acme: SpecIdManufacturer = { id: 'acme', name: 'Acme Packaging', country: null, stage: 'quoted', stageSet: null, quotes: [] };
const list: SpecIdManufacturers = { specId: { id: SPEC, name: 'Invented PP cup', code: 'CUP' }, manufacturers: [acme] };

describe('useSetManufacturerStage', () => {
  it("asks for the Spec ID's manufacturers again once a stage is set", async () => {
    const manufacturers = vi.fn(async () => list);
    const setManufacturerStage = vi.fn(async () => ({ ...acme, stage: 'sampling' as const }));
    const gateway = gatewayWith({ manufacturers, setManufacturerStage });
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={client}>
        <AtlasGatewayProvider gateway={gateway}>{children}</AtlasGatewayProvider>
      </QueryClientProvider>
    );
    const { result } = renderHook(
      () => ({
        query: useQuery({ queryKey: atlasKeys.manufacturers(SPEC), queryFn: () => gateway.manufacturers(SPEC) }),
        set: useSetManufacturerStage(SPEC),
      }),
      { wrapper },
    );
    await waitFor(() => expect(result.current.query.isSuccess).toBe(true));

    await act(() => result.current.set.mutateAsync({ manufacturerId: 'acme', stage: 'sampling' }));

    expect(setManufacturerStage).toHaveBeenCalledWith(SPEC, 'acme', 'sampling');
    await waitFor(() => expect(manufacturers).toHaveBeenCalledTimes(2));
  });
});
