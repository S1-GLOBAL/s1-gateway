import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { useState } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import type { AtlasGateway } from '../../application/atlas-gateway';
import { AtlasGatewayProvider } from '../../application/atlas-gateway-context';
import { gatewayWith, ILLUSTRATIVE, readCode, s1Dictionary, savedFor } from '../../application/testing/atlas-fixtures';
import type { SavedSpecId } from '../../domain/atlas';
import { initialBuildForm, type BuildForm } from '../../domain/build-facts';
import { SpecIdWorkspace } from './SpecIdWorkspace';

const NO_FITS = { fits: [], mightFit: [] };

function Harness({ productType, match, ownId }: { productType: string; match: SavedSpecId | null; ownId?: string }) {
  const [form, setForm] = useState<BuildForm>(() => initialBuildForm(productType));
  return (
    <SpecIdWorkspace
      dictionary={s1Dictionary}
      form={form}
      onChange={setForm}
      decoded={readCode(ILLUSTRATIVE)}
      fields={{}}
      match={match}
      ownId={ownId}
      side={null}
      timeZone="UTC"
    />
  );
}

function renderWorkspace(
  { productType = 'BLD', match = null, ownId }: { productType?: string; match?: SavedSpecId | null; ownId?: string } = {},
  overrides: Partial<AtlasGateway> = {},
) {
  const gateway = gatewayWith({ findSimilar: async () => NO_FITS, ...overrides });
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={queryClient}>
      <AtlasGatewayProvider gateway={gateway}>
        <MemoryRouter>
          <Harness productType={productType} match={match} ownId={ownId} />
        </MemoryRouter>
      </AtlasGatewayProvider>
    </QueryClientProvider>,
  );
}

const field = (label: string) => screen.queryByLabelText(label);

describe('SpecIdWorkspace, the slots that apply', () => {
  it.each([
    ['BLD', 'bowl lid', ['Nominal capacity', 'Bottom diameter', 'Gusset'], 'nominal capacity, bottom diameter and gusset'],
    ['CLD', 'cup lid', ['Nominal capacity', 'Bottom diameter', 'Gusset'], 'nominal capacity, bottom diameter and gusset'],
    ['BWL', 'bowl', ['Profile', 'Gusset'], 'profile and gusset'],
    [
      'SUP',
      'stand-up pouch',
      ['Profile', 'Top diameter', 'Bottom diameter', 'Length'],
      'shape, profile, top diameter, bottom diameter and length',
    ],
  ])('for a %s, hides what it never has and names it', (productType, typeName, hidden, named) => {
    renderWorkspace({ productType });

    for (const label of hidden) expect(field(label)).toBeNull();
    expect(screen.getByText(`Not asked for a ${typeName}: ${named}. They're written as X in the code.`)).toBeTruthy();
    expect(field('Height')).not.toBeNull();
  });

  it('hides the shape group of a stand-up pouch, which has neither shape nor profile', () => {
    renderWorkspace({ productType: 'SUP' });
    expect(screen.queryByRole('radiogroup', { name: 'Shape' })).toBeNull();
    expect(screen.queryByRole('region', { name: 'Shape' })).toBeNull();
  });

  it('shows top diameter as "Not known", disabled, until a shape is chosen', () => {
    renderWorkspace({ productType: 'BLD' });
    const topDiameter = field('Top diameter') as HTMLInputElement;
    expect(topDiameter.disabled).toBe(true);
    expect(topDiameter.placeholder).toBe('Not known');

    fireEvent.click(screen.getByRole('radio', { name: 'Round' }));

    expect((field('Top diameter') as HTMLInputElement).disabled).toBe(false);
    expect(field('Length')).toBeNull();
  });

  it('offers "Not known" first for the shape, and chooses it to begin with', () => {
    renderWorkspace();
    const shapes = within(screen.getByRole('radiogroup', { name: 'Shape' })).getAllByRole('radio');
    expect(shapes.map((radio) => radio.textContent)).toEqual(['Not known', 'Round', 'Square']);
    expect(shapes[0]?.getAttribute('aria-checked')).toBe('true');
  });
});

describe('SpecIdWorkspace, already saved', () => {
  it('highlights an exact match with the way to it', () => {
    const match = savedFor(ILLUSTRATIVE, 'Illustrative lid', { id: '00000000-0000-4000-8000-000000000009' });
    renderWorkspace({ match });

    const panel = screen.getByRole('region', { name: 'Already saved' });
    expect(within(panel).getByText('Illustrative lid')).toBeTruthy();
    expect(within(panel).getByText('Same code · saved by Ada Invented on 16 October 2026')).toBeTruthy();
    expect(within(panel).getByRole('link', { name: 'Open and update it' }).getAttribute('href')).toBe(
      '/atlas/00000000-0000-4000-8000-000000000009',
    );
  });

  it('folds similar Spec IDs away, never itself, the match or one with the same code', async () => {
    const own = savedFor(ILLUSTRATIVE, 'This lid', { id: '00000000-0000-4000-8000-000000000001' });
    const sameCode = savedFor(ILLUSTRATIVE, 'Same code', { id: '00000000-0000-4000-8000-000000000003' });
    const alike = savedFor(ILLUSTRATIVE.replace('.0033.', '.0040.'), 'Heavier lid', {
      id: '00000000-0000-4000-8000-000000000002',
    });
    const might = savedFor(ILLUSTRATIVE.replace('.0090.', '.0000.'), 'Unmeasured lid', {
      id: '00000000-0000-4000-8000-000000000004',
    });
    renderWorkspace(
      { ownId: own.id },
      { findSimilar: async () => ({ fits: [own, sameCode, alike], mightFit: [alike, might] }) },
    );

    const summary = await screen.findByText('2 similar Spec IDs');
    const details = summary.closest('details') as HTMLDetailsElement;
    expect(details.open).toBe(false);
    expect(within(details).getAllByRole('link').map((link) => link.textContent)).toEqual([
      `Heavier lid${alike.code}`,
      `Unmeasured lid${might.code}`,
    ]);
    expect(screen.queryByRole('region', { name: 'Already saved' })).toBeNull();
  });

  it('says nothing about similar Spec IDs when there are none', async () => {
    renderWorkspace();
    await screen.findByText('Not asked for a bowl lid: nominal capacity, bottom diameter and gusset. They\'re written as X in the code.');
    expect(screen.queryByText(/similar Spec ID/)).toBeNull();
  });
});
