import { fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it } from 'vitest';
import { navItemsFor } from '../nav';
import { Sidebar } from './Sidebar';
import { SIDEBAR_STORAGE_KEY, useSidebarCollapsed } from './use-sidebar-collapsed';

const ADA = {
  firstName: 'Ada',
  lastName: 'Lovelace',
  fullName: 'Ada Lovelace',
  email: 'ada@sourceone.global',
};

function Harness({ isAdmin, waiting }: { isAdmin: boolean; waiting: number }) {
  const [collapsed, toggle] = useSidebarCollapsed();
  return (
    <Sidebar
      items={navItemsFor(isAdmin)}
      badges={{ 'dictionary-waiting': waiting }}
      account={ADA}
      collapsed={collapsed}
      onToggle={toggle}
    />
  );
}

function renderAt(path: string, isAdmin = false, waiting = 0) {
  render(
    <MemoryRouter initialEntries={[path]}>
      <Harness isAdmin={isAdmin} waiting={waiting} />
    </MemoryRouter>,
  );
}

beforeEach(() => window.localStorage.clear());

describe('Sidebar', () => {
  it('marks the current page', () => {
    renderAt('/theme');
    expect(screen.getByRole('link', { name: 'Theme' }).getAttribute('aria-current')).toBe('page');
  });

  it('marks Atlas current on a page inside it', () => {
    renderAt('/atlas/new');
    expect(screen.getByRole('link', { name: 'Atlas' }).getAttribute('aria-current')).toBe('page');
    expect(screen.getByRole('link', { name: 'Theme' }).getAttribute('aria-current')).toBeNull();
  });

  it('offers Accounts to an admin only', () => {
    renderAt('/theme');
    expect(screen.queryByRole('link', { name: 'Accounts' })).toBeNull();
    expect(screen.queryByRole('list', { name: 'Access' })).toBeNull();
  });

  it('offers Accounts to an admin', () => {
    renderAt('/theme', true);
    expect(screen.getByRole('link', { name: 'Accounts' })).toBeTruthy();
  });

  it('counts the suggestions waiting on Dictionary Changes, and says so to a screen reader', () => {
    renderAt('/theme', true, 2);
    const link = screen.getByRole('link', { name: 'Dictionary Changes 2 suggestions waiting' });
    expect(link.textContent).toContain('2');
  });

  it('shows no count when none is waiting', () => {
    renderAt('/theme', true, 0);
    expect(screen.getByRole('link', { name: 'Dictionary Changes' }).textContent).toBe('Dictionary Changes');
  });

  it('groups Atlas and Dictionary Changes under Catalog', () => {
    renderAt('/atlas', true);
    const catalog = screen.getByRole('list', { name: 'Catalog' });
    expect(within(catalog).getByRole('link', { name: 'Atlas' })).toBeTruthy();
    expect(within(catalog).getByRole('link', { name: 'Dictionary Changes' })).toBeTruthy();
    expect(within(catalog).queryByRole('link', { name: 'Accounts' })).toBeNull();
  });

  it('groups Accounts under Access, and Theme under Other', () => {
    renderAt('/theme', true);
    const access = screen.getByRole('list', { name: 'Access' });
    expect(within(access).getByRole('link', { name: 'Accounts' })).toBeTruthy();
    expect(within(access).queryByRole('link', { name: 'Theme' })).toBeNull();
    const other = screen.getByRole('list', { name: 'Other' });
    expect(within(other).getByRole('link', { name: 'Theme' })).toBeTruthy();
  });

  it('keeps the Catalog name for a screen reader when the rail is folded', () => {
    window.localStorage.setItem(SIDEBAR_STORAGE_KEY, 'collapsed');
    renderAt('/atlas');
    expect(screen.getByText('Catalog').className).toContain('sr-only');
  });

  it('writes Source One beside the mark, and drops the name when folded', () => {
    renderAt('/theme');
    expect(screen.getByText('Source One')).toBeTruthy();
    expect(screen.queryByRole('img', { name: 'Source One' })).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Collapse sidebar' }));
    expect(screen.queryByText('Source One')).toBeNull();
    expect(screen.getByRole('img', { name: 'Source One' })).toBeTruthy();
  });

  it('shows who is signed in beside the collapse control', () => {
    renderAt('/theme');
    expect(screen.getByText('Ada Lovelace')).toBeTruthy();
    expect(screen.getByText('ada@sourceone.global')).toBeTruthy();
    expect(screen.getByText('AL')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Collapse sidebar' })).toBeTruthy();
  });

  it('uses the first two letters when there is no family name', () => {
    render(
      <MemoryRouter>
        <Sidebar
          items={navItemsFor(false)}
          account={{ firstName: 'Ada', lastName: '', fullName: 'Ada', email: 'ada@sourceone.global' }}
          collapsed={false}
          onToggle={() => undefined}
        />
      </MemoryRouter>,
    );
    expect(screen.getByText('AD')).toBeTruthy();
    expect(screen.getByText('Ada')).toBeTruthy();
  });

  it('folds to its rail and remembers it', () => {
    renderAt('/theme');
    fireEvent.click(screen.getByRole('button', { name: 'Collapse sidebar' }));
    expect(window.localStorage.getItem(SIDEBAR_STORAGE_KEY)).toBe('collapsed');
    expect(screen.getByRole('button', { name: 'Expand sidebar' })).toBeTruthy();
    // Folded, the link and the signed-in name stay available to assistive technology.
    expect(screen.getByRole('link', { name: 'Theme' })).toBeTruthy();
    expect(screen.getByTitle('Ada Lovelace').parentElement?.className).toContain('sr-only');
    expect(screen.getByTitle('ada@sourceone.global')).toBeTruthy();
    expect(screen.getByText('AL')).toBeTruthy();
  });

  it('starts folded when it was left folded', () => {
    window.localStorage.setItem(SIDEBAR_STORAGE_KEY, 'collapsed');
    renderAt('/theme');
    expect(screen.getByRole('button', { name: 'Expand sidebar' })).toBeTruthy();
  });

  it('stacks the folded rail above the page so its labels stay visible', () => {
    window.localStorage.setItem(SIDEBAR_STORAGE_KEY, 'collapsed');
    renderAt('/theme');
    expect(screen.getByRole('complementary', { name: 'Main' }).className).toContain('z-20');
  });
});
