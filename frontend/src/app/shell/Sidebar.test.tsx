import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it } from 'vitest';
import { Sidebar } from './Sidebar';
import { SIDEBAR_STORAGE_KEY, useSidebarCollapsed } from './use-sidebar-collapsed';

function Harness() {
  const [collapsed, toggle] = useSidebarCollapsed();
  return <Sidebar collapsed={collapsed} onToggle={toggle} />;
}

function renderAt(path: string) {
  render(
    <MemoryRouter initialEntries={[path]}>
      <Harness />
    </MemoryRouter>,
  );
}

beforeEach(() => window.localStorage.clear());

describe('Sidebar', () => {
  it('marks the current page', () => {
    renderAt('/');
    expect(screen.getByRole('link', { name: 'Tools' }).getAttribute('aria-current')).toBe('page');
    expect(screen.getByRole('link', { name: 'Theme' }).getAttribute('aria-current')).toBeNull();
  });

  it('folds to its rail and remembers it', () => {
    renderAt('/');
    fireEvent.click(screen.getByRole('button', { name: 'Collapse sidebar' }));
    expect(window.localStorage.getItem(SIDEBAR_STORAGE_KEY)).toBe('collapsed');
    expect(screen.getByRole('button', { name: 'Expand sidebar' })).toBeTruthy();
    // Folded, the link keeps its name for assistive technology.
    expect(screen.getByRole('link', { name: 'Tools' })).toBeTruthy();
  });

  it('starts folded when it was left folded', () => {
    window.localStorage.setItem(SIDEBAR_STORAGE_KEY, 'collapsed');
    renderAt('/');
    expect(screen.getByRole('button', { name: 'Expand sidebar' })).toBeTruthy();
  });
});
