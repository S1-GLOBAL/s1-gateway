import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { invite } from '@/test/fake-accounts-gateway';
import { InvitedSection } from './InvitedSection';

describe('InvitedSection', () => {
  it('shows each invite as its email and "Expires 16 October 2026"', () => {
    const invites = [invite({ email: 'grace@sourceone.global', expiresAt: new Date('2026-10-16T08:00:00Z') })];
    render(<InvitedSection invites={invites} busy={false} onRevoke={() => undefined} timeZone="UTC" />);

    const row = screen.getByText('grace@sourceone.global').closest('li')!;
    expect(within(row).getByText('Expires 16 October 2026')).toBeTruthy();
  });

  it("dates the expiry in the viewer's time zone", () => {
    const invites = [invite({ expiresAt: new Date('2026-10-16T20:00:00Z') })];
    render(<InvitedSection invites={invites} busy={false} onRevoke={() => undefined} timeZone="Asia/Manila" />);
    expect(screen.getByText('Expires 17 October 2026')).toBeTruthy();
  });

  it('is the Invited section, and says when no invite is waiting', () => {
    render(<InvitedSection invites={[]} busy={false} onRevoke={() => undefined} timeZone="UTC" />);
    expect(screen.getByRole('region', { name: /^Invited/ })).toBeTruthy();
    expect(screen.getByText('No invites waiting.')).toBeTruthy();
  });

  it('asks to revoke the invite whose Revoke was pressed, and offers nothing while busy', () => {
    const onRevoke = vi.fn();
    const first = invite({ id: 'i1', email: 'grace@sourceone.global' });
    const second = invite({ id: 'i2', email: 'alan@sourceone.global' });
    const { rerender } = render(
      <InvitedSection invites={[first, second]} busy={false} onRevoke={onRevoke} timeZone="UTC" />,
    );

    const row = screen.getByText('alan@sourceone.global').closest('li')!;
    fireEvent.click(within(row).getByRole('button', { name: 'Revoke' }));
    expect(onRevoke).toHaveBeenCalledWith(second);

    rerender(<InvitedSection invites={[first, second]} busy onRevoke={onRevoke} timeZone="UTC" />);
    const buttons = screen.getAllByRole('button', { name: 'Revoke' }) as HTMLButtonElement[];
    expect(buttons.every((button) => button.disabled)).toBe(true);
  });
});
