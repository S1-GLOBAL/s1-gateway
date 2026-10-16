import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it } from 'vitest';
import { navItemsFor } from '../nav';
import { Sidebar } from './Sidebar';
import { SIDEBAR_STORAGE_KEY, useSidebarCollapsed } from './use-sidebar-collapsed';

function Harness({ isAdmin }: { isAdmin: boolean }) {
  const [collapsed, toggle] = useSidebarCollapsed();
  return <Sidebar items={navItemsFor(isAdmin)} collapsed={collapsed} onToggle={toggle} />;
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

  it('offers Accounts to an admin only', () => {
    renderAt('/theme');
    expect(screen.queryByRole('link', { name: 'Accounts' })).toBeNull();
  });

  it('offers Accounts to an admin', () => {
    renderAt('/theme', true);
    expect(screen.getByRole('link', { name: 'Accounts' })).toBeTruthy();
  });

  it('folds to its rail and remembers it', () => {
    renderAt('/theme');
    fireEvent.click(screen.getByRole('button', { name: 'Collapse sidebar' }));
    expect(window.localStorage.getItem(SIDEBAR_STORAGE_KEY)).toBe('collapsed');
    expect(screen.getByRole('button', { name: 'Expand sidebar' })).toBeTruthy();
    // Folded, the link keeps its name for assistive technology.
    expect(screen.getByRole('link', { name: 'Theme' })).toBeTruthy();
  });

  it('starts folded when it was left folded', () => {
    window.localStorage.setItem(SIDEBAR_STORAGE_KEY, 'collapsed');
    renderAt('/theme');
    expect(screen.getByRole('button', { name: 'Expand sidebar' })).toBeTruthy();
  });
});