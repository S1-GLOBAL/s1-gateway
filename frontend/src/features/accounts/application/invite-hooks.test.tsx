import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import { Suspense, type ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { AppError } from '@/shared/application/app-error';
import { fakeAccountsGateway, invite } from '@/test/fake-accounts-gateway';
import type { AccountsGateway } from './accounts-gateway';
import { AccountsGatewayProvider } from './accounts-gateway-context';
import { accountsKeys } from './accounts.keys';
import { useCreateInvite } from './use-create-invite';
import { useInvite } from './use-invite';
import { useInvites } from './use-invites';
import { useRegister } from './use-register';
import { useRevokeInvite } from './use-revoke-invite';

function wrapperFor(gateway: AccountsGateway, client = new QueryClient()) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={client}>
        <AccountsGatewayProvider gateway={gateway}>
          <Suspense fallback={null}>{children}</Suspense>
        </AccountsGatewayProvider>
      </QueryClientProvider>
    );
  };
}

describe('invite hooks', () => {
  it('lists the invites under the accounts key', async () => {
    const client = new QueryClient();
    const gateway = fakeAccountsGateway({ listInvites: async () => [invite()] });
    const { result } = renderHook(() => useInvites(), { wrapper: wrapperFor(gateway, client) });
    await waitFor(() => expect(result.current.data).toEqual([invite()]));
    expect(client.getQueryData([...accountsKeys.all, 'invites'])).toEqual([invite()]);
  });

  it('refetches the invites after creating one', async () => {
    const listInvites = vi.fn<AccountsGateway['listInvites']>().mockResolvedValue([]);
    const createInvite = vi.fn<AccountsGateway['createInvite']>().mockResolvedValue({
      invite: invite(),
      inviteUrl: 'https://gateway.example/register?token=abc',
    });
    const wrapper = wrapperFor(fakeAccountsGateway({ listInvites, createInvite }));
    const { result } = renderHook(() => ({ list: useInvites(), create: useCreateInvite() }), { wrapper });
    await waitFor(() => expect(result.current.list.data).toEqual([]));

    await act(() => result.current.create.mutateAsync('grace@sourceone.global'));

    expect(createInvite).toHaveBeenCalledWith('grace@sourceone.global');
    await waitFor(() => expect(listInvites).toHaveBeenCalledTimes(2));
  });

  it('refetches the invites after revoking one, and after a revoke that failed', async () => {
    const listInvites = vi.fn<AccountsGateway['listInvites']>().mockResolvedValue([invite()]);
    const revokeInvite = vi
      .fn<AccountsGateway['revokeInvite']>()
      .mockResolvedValueOnce(invite())
      .mockRejectedValueOnce(new AppError('INVITE_NOT_FOUND', 'This invite was already used or revoked.'));
    const wrapper = wrapperFor(fakeAccountsGateway({ listInvites, revokeInvite }));
    const { result } = renderHook(() => ({ list: useInvites(), revoke: useRevokeInvite() }), { wrapper });
    await waitFor(() => expect(result.current.list.data).toHaveLength(1));

    await act(() => result.current.revoke.mutateAsync('i1'));
    await waitFor(() => expect(listInvites).toHaveBeenCalledTimes(2));

    await act(() => result.current.revoke.mutateAsync('i1').catch(() => undefined));
    await waitFor(() => expect(listInvites).toHaveBeenCalledTimes(3));
    expect(revokeInvite).toHaveBeenCalledWith('i1');
  });

  it('reads one invite by its token', async () => {
    const getInvite = vi.fn<AccountsGateway['getInvite']>().mockResolvedValue({
      email: 'ada@sourceone.global',
      expiresAt: new Date('2026-10-23T08:00:00.000Z'),
    });
    const { result } = renderHook(() => useInvite('tok'), { wrapper: wrapperFor(fakeAccountsGateway({ getInvite })) });
    await waitFor(() => expect(result.current.data?.email).toBe('ada@sourceone.global'));
    expect(getInvite).toHaveBeenCalledWith('tok');
  });

  it('does not ask again about a link that no longer works', async () => {
    const getInvite = vi
      .fn<AccountsGateway['getInvite']>()
      .mockRejectedValue(new AppError('INVITE_INVALID', 'This invite link no longer works.'));
    const { result } = renderHook(() => useInvite('old'), { wrapper: wrapperFor(fakeAccountsGateway({ getInvite })) });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(getInvite).toHaveBeenCalledTimes(1);
  });

  it('registers through the gateway', async () => {
    const register = vi.fn<AccountsGateway['register']>();
    const { result } = renderHook(() => useRegister(), { wrapper: wrapperFor(fakeAccountsGateway({ register })) });
    const registration = {
      token: 'tok',
      firstName: 'Ada',
      lastName: 'Lovelace',
      password: 'a long enough password',
      confirmPassword: 'a long enough password',
    };
    await act(() => result.current.mutateAsync(registration));
    expect(register).toHaveBeenCalledWith(registration);
  });
});
