import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { Sheet } from './Sheet';

describe('Sheet', () => {
  it('is closed until asked to open', () => {
    render(
      <Sheet open={false} onClose={() => undefined} title="Add a tool">
        <p>Body</p>
      </Sheet>,
    );
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('opens as a dialog named by its title', () => {
    render(
      <Sheet open onClose={() => undefined} title="Add a tool" description="It appears for everyone.">
        <p>Body</p>
      </Sheet>,
    );
    const dialog = screen.getByRole('dialog', { name: 'Add a tool' });
    expect((dialog as HTMLDialogElement).open).toBe(true);
    expect(screen.getByText('Body')).toBeTruthy();
  });

  it('asks to close from its close button', () => {
    const onClose = vi.fn();
    render(
      <Sheet open onClose={onClose} title="Add a tool">
        <p>Body</p>
      </Sheet>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
