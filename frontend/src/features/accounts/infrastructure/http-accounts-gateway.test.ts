import axios, { AxiosError, type AxiosAdapter, type AxiosResponse } from 'axios';
import { describe, expect, it } from 'vitest';
import { AppError } from '@/shared/application/app-error';
import { HttpAccountsGateway } from './http-accounts-gateway';

const wireInvite = { id: 'i1', email: 'ada@sourceone.global', expiresAt: '2026-10-23T08:00:00.000Z' };

const wireAccount = {
  id: 'a1',
  email: 'ada@sourceone.global',
  firstName: 'Ada',
  lastName: 'Lovelace',
  fullName: 'Ada Lovelace',
  status: 'approved',
  mustChangePassword: false,
  createdAt: '2026-10-16T08:00:00.000Z',
  isAdmin: false,
};

interface Sent {
  method: string | undefined;
  url: string | undefined;
  body: unknown;
}

function gatewayAnswering(status: number, data: unknown, sent: Sent[] = []): HttpAccountsGateway {
  const adapter: AxiosAdapter = async (config) => {
    sent.push({
      method: config.method,
      url: config.url,
      body: config.data === undefined ? undefined : JSON.parse(config.data as string),
    });
    const response: AxiosResponse = { data, status, statusText: String(status), headers: {}, config };
    if (status >= 400) throw new AxiosError('Request failed', 'ERR_BAD_RESPONSE', config, null, response);
    return response;
  };
  return new HttpAccountsGateway(axios.create({ adapter }));
}

describe('HttpAccountsGateway invites', () => {
  it('creates an invite and returns it with its link, the expiry as a Date', async () => {
    const sent: Sent[] = [];
    const created = await gatewayAnswering(
      201,
      { data: { invite: wireInvite, inviteUrl: 'https://gateway.example/register?token=tok' } },
      sent,
    ).createInvite('Ada@SourceOne.Global');

    expect(sent).toEqual([{ method: 'post', url: '/accounts/invites', body: { email: 'Ada@SourceOne.Global' } }]);
    expect(created).toEqual({
      invite: { id: 'i1', email: 'ada@sourceone.global', expiresAt: new Date('2026-10-23T08:00:00.000Z') },
      inviteUrl: 'https://gateway.example/register?token=tok',
    });
  });

  it('lists the open invites', async () => {
    const sent: Sent[] = [];
    const invites = await gatewayAnswering(200, { data: [wireInvite] }, sent).listInvites();
    expect(sent).toEqual([{ method: 'get', url: '/accounts/invites', body: undefined }]);
    expect(invites).toEqual([
      { id: 'i1', email: 'ada@sourceone.global', expiresAt: new Date('2026-10-23T08:00:00.000Z') },
    ]);
  });

  it('revokes an invite by its id', async () => {
    const sent: Sent[] = [];
    const revoked = await gatewayAnswering(200, { data: wireInvite }, sent).revokeInvite('i1');
    expect(sent).toEqual([{ method: 'post', url: '/accounts/invites/i1/revoke', body: undefined }]);
    expect(revoked.email).toBe('ada@sourceone.global');
  });

  it('reads an invite by its token, encoded into the path', async () => {
    const sent: Sent[] = [];
    const details = await gatewayAnswering(
      200,
      { data: { email: 'ada@sourceone.global', expiresAt: '2026-10-23T08:00:00.000Z' } },
      sent,
    ).getInvite('a/b?c');
    expect(sent).toEqual([{ method: 'get', url: '/auth/invites/a%2Fb%3Fc', body: undefined }]);
    expect(details).toEqual({ email: 'ada@sourceone.global', expiresAt: new Date('2026-10-23T08:00:00.000Z') });
  });

  it('registers with the token, the names and both passwords, and no email', async () => {
    const sent: Sent[] = [];
    const registration = {
      token: 'tok',
      firstName: 'Ada',
      lastName: 'Lovelace',
      password: 'a long enough password',
      confirmPassword: 'a long enough password',
    };
    const account = await gatewayAnswering(201, { data: wireAccount }, sent).register(registration);
    expect(sent).toEqual([{ method: 'post', url: '/auth/register', body: registration }]);
    expect(account.fullName).toBe('Ada Lovelace');
    expect(account.createdAt).toEqual(new Date('2026-10-16T08:00:00.000Z'));
  });

  it('rejects an unusable invite with INVITE_INVALID and its message', async () => {
    const gateway = gatewayAnswering(404, {
      error: { code: 'INVITE_INVALID', message: 'This invite link no longer works.' },
    });
    const failure = await gateway.getInvite('old').catch((error: unknown) => error);
    expect(failure).toBeInstanceOf(AppError);
    expect((failure as AppError).code).toBe('INVITE_INVALID');
    expect((failure as AppError).message).toBe('This invite link no longer works.');
  });

  it("carries the invite form's field error under email", async () => {
    const gateway = gatewayAnswering(409, {
      error: {
        code: 'ACCOUNT_EXISTS',
        message: 'An account already exists for that email.',
        details: { fields: { email: ['An account already exists for that email.'] } },
      },
    });
    const failure = await gateway.createInvite('ada@sourceone.global').catch((error: unknown) => error);
    expect((failure as AppError).fields).toEqual({ email: ['An account already exists for that email.'] });
  });
});
