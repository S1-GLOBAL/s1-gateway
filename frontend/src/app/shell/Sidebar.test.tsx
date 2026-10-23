import { fireEvent, render, screen } from '@testing-library/react';
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

function Harness({ isAdmin }: { isAdmin: boolean }) {
  const [collapsed, toggle] = useSidebarCollapsed();
  return <Sidebar items={navItemsFor(isAdmin)} account={ADA} collapsed={collapsed} onToggle={toggle} />;
}

function renderAt(path: string, isAdmin = false) {
  render(
    <MemoryRouter initialEntries={[path]}>
      <Harness isAdmin={isAdmin} />
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
  });

  it('offers Accounts to an admin', () => {
    renderAt('/theme', true);
    expect(screen.getByRole('link', { name: 'Accounts' })).toBeTruthy();
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
