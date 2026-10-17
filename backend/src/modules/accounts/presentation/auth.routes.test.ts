import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { buildHealthModule } from '../../health/index.js';
import {
  FixedClock,
  RecordingLogger,
  SequentialIdGenerator,
} from '../../../shared/application/testing/fakes.js';
import { createApp } from '../../../shared/presentation/http/create-app.js';
import { ApproveAccount } from '../application/approve-account.js';
import { ChangePassword } from '../application/change-password.js';
import { CreateInvite } from '../application/create-invite.js';
import { CreatePasswordResetLink } from '../application/create-password-reset-link.js';
import { DisableAccount } from '../application/disable-account.js';
import { GetInvite } from '../application/get-invite.js';
import { GetMe } from '../application/get-me.js';
import { ListAccounts } from '../application/list-accounts.js';
import { ListInvites } from '../application/list-invites.js';
import { RegisterWithInvite } from '../application/register-with-invite.js';
import { ResetPasswordWithToken } from '../application/reset-password-with-token.js';
import { RevokeInvite } from '../application/revoke-invite.js';
import { SignIn } from '../application/sign-in.js';
import { SignOut } from '../application/sign-out.js';
import { FakePasswordHasher } from '../application/testing/fake-password-hasher.js';
import { FakeTokenGenerator } from '../application/testing/fake-token-generator.js';
import { InMemoryAccountInviteRepository } from '../application/testing/in-memory-account-invite-repository.js';
import { InMemoryAccountRepository } from '../application/testing/in-memory-account-repository.js';
import { InMemoryPasswordResetTokenRepository } from '../application/testing/in-memory-password-reset-token-repository.js';
import { InMemorySessionRepository } from '../application/testing/in-memory-session-repository.js';
import { Account } from '../domain/account.js';
import { AccountInvite, INVITE_TTL_MS } from '../domain/account-invite.js';
import { CreateTool } from '../../tools/application/create-tool.js';
import { ListTools } from '../../tools/application/list-tools.js';
import { InMemoryToolRepository } from '../../tools/application/testing/in-memory-tool-repository.js';
import { ToolsController } from '../../tools/presentation/tools.controller.js';
import { createToolsRouter } from '../../tools/presentation/tools.routes.js';
import { AccountsController } from './accounts.controller.js';
import { createAccountsRouter } from './accounts.routes.js';
import { AuthController } from './auth.controller.js';
import { createPublicAuthRouter, createSessionAuthRouter } from './auth.routes.js';
import { createAdminGate, createSessionGate, SESSION_COOKIE } from './session-gate.js';

const ADMIN = 'admin@sourceone.global';
const STAFF = 'staff@sourceone.global';
const PASSWORD = 'correct-horse';

function setup() {
  const accounts = new InMemoryAccountRepository();
  const sessions = new InMemorySessionRepository();
  const resetTokens = new InMemoryPasswordResetTokenRepository();
  const invites = new InMemoryAccountInviteRepository(accounts);
  const hasher = new FakePasswordHasher();
  const tokens = new FakeTokenGenerator();
  const clock = new FixedClock(new Date('2026-10-16T12:00:00.000Z'));
  const ids = new SequentialIdGenerator();
  const adminEmails = [ADMIN];

  const authController = new AuthController(
    new SignIn(accounts, sessions, hasher, tokens, clock, ids),
    new SignOut(sessions, tokens),
    new GetMe(accounts, sessions, tokens, clock),
    new ChangePassword(accounts, sessions, hasher, tokens, clock),
    new ResetPasswordWithToken(accounts, resetTokens, sessions, hasher, tokens, clock),
    adminEmails,
    false,
    {
      get: new GetInvite(invites, tokens, clock),
      register: new RegisterWithInvite(invites, hasher, tokens, clock, ids),
    },
  );

  const accountsController = new AccountsController(
    new ListAccounts(accounts),
    new ApproveAccount(accounts, clock),
    new DisableAccount(accounts, sessions),
    new CreatePasswordResetLink(accounts, resetTokens, sessions, tokens, clock, ids),
    adminEmails,
    'http://localhost:5173',
    {
      create: new CreateInvite(accounts, invites, tokens, clock, ids),
      list: new ListInvites(invites, clock),
      revoke: new RevokeInvite(invites, clock),
    },
  );

  const toolsRepo = new InMemoryToolRepository();
  const toolsController = new ToolsController(
    new ListTools(toolsRepo),
    new CreateTool(toolsRepo, clock, ids),
  );

  const gateDeps = {
    findSessionByTokenHash: (hash: string) => sessions.findByTokenHash(hash),
    saveSession: (session: Parameters<typeof sessions.save>[0]) => sessions.save(session),
    findAccountById: (id: string) => accounts.findById(id),
    hashToken: (token: string) => tokens.hash(token),
    clock,
    accountAdminEmails: adminEmails,
    cookieSecure: false,
  };

  const logger = new RecordingLogger();
  const app = createApp({
    logger,
    corsOrigin: 'http://localhost:5173',
    sessionGate: createSessionGate(gateDeps),
    adminGate: createAdminGate(gateDeps),
    modules: [
      buildHealthModule(),
      { path: '/auth', router: createPublicAuthRouter(authController), access: 'public' },
      { path: '/auth', router: createSessionAuthRouter(authController), access: 'session' },
      { path: '/accounts', router: createAccountsRouter(accountsController), access: 'admin' },
      { path: '/tools', router: createToolsRouter(toolsController), access: 'session' },
    ],
  });

  return { app, accounts, invites, hasher, clock, logger };
}

type TestApp = ReturnType<typeof setup>;

/** An account added straight to the repository: no route creates one without an invite. */
async function seedAccount(
  context: TestApp,
  email: string,
  options: { approved?: boolean; firstName?: string; lastName?: string } = {},
): Promise<void> {
  const registered = Account.register(
    {
      email,
      firstName: options.firstName ?? 'Seeded',
      lastName: options.lastName ?? 'Person',
      passwordHash: await context.hasher.hash(PASSWORD),
      autoApprove: options.approved ?? true,
    },
    `00000000-0000-4000-8000-${String((await context.accounts.list()).length + 900).padStart(12, '0')}`,
    context.clock.now(),
  );
  await context.accounts.add(registered.value);
}

describe('auth and accounts HTTP', () => {
  it('keeps health public and tools behind a session', async () => {
    const { app } = setup();
    expect((await request(app).get('/api/v1/health')).status).toBe(200);
    const tools = await request(app).get('/api/v1/tools');
    expect(tools.status).toBe(401);
    expect(tools.body.error.code).toBe('SIGN_IN_REQUIRED');
  });

  it('signs in an admin, renews the session cookie, and reaches tools', async () => {
    const context = setup();
    await seedAccount(context, ADMIN);
    const agent = request.agent(context.app);

    const signedIn = await agent
      .post('/api/v1/auth/sign-in')
      .send({ email: ADMIN, password: PASSWORD });
    expect(signedIn.status).toBe(200);
    const setCookie = signedIn.headers['set-cookie'];
    const cookieHeader = Array.isArray(setCookie) ? setCookie.join(';') : (setCookie ?? '');
    expect(cookieHeader).toContain(SESSION_COOKIE);

    const me = await agent.get('/api/v1/auth/me');
    expect(me.status).toBe(200);
    expect(me.body.data.isAdmin).toBe(true);
    const renewedCookie = me.headers['set-cookie'];
    const renewedHeader = Array.isArray(renewedCookie) ? renewedCookie.join(';') : (renewedCookie ?? '');
    expect(renewedHeader).toContain(SESSION_COOKIE);
    expect(renewedHeader.toLowerCase()).toContain('max-age=');

    expect((await agent.get('/api/v1/tools')).status).toBe(200);
  });

  it('no longer creates an account at POST /auth/sign-up: 404 when signed in, 401 when not', async () => {
    const context = setup();
    await seedAccount(context, ADMIN);
    const agent = request.agent(context.app);
    await agent.post('/api/v1/auth/sign-in').send({ email: ADMIN, password: PASSWORD });
    const body = { email: STAFF, fullName: 'Staff Member', password: PASSWORD };

    const signedIn = await agent.post('/api/v1/auth/sign-up').send(body);
    expect(signedIn.status).toBe(404);
    expect(signedIn.body.error.code).toBe('NOT_FOUND');

    // Signed out it meets the session gate first, as every unknown path does.
    const signedOut = await request(context.app).post('/api/v1/auth/sign-up').send(body);
    expect(signedOut.status).toBe(401);
    expect(signedOut.body.error.code).toBe('SIGN_IN_REQUIRED');

    expect(await context.accounts.findByEmail(STAFF)).toBeNull();
  });

  it('keeps a pending staff account from signing in until approved', async () => {
    const context = setup();
    const { app } = context;
    await seedAccount(context, ADMIN);
    await seedAccount(context, STAFF, { approved: false, firstName: 'Staff', lastName: 'Member' });
    const agent = request.agent(app);
    await agent.post('/api/v1/auth/sign-in').send({ email: ADMIN, password: PASSWORD });

    const blocked = await request(app)
      .post('/api/v1/auth/sign-in')
      .send({ email: STAFF, password: PASSWORD });
    expect(blocked.status).toBe(403);
    expect(blocked.body.error.code).toBe('ACCOUNT_PENDING');
    expect(blocked.headers['set-cookie']).toBeUndefined();

    const listed = await agent.get('/api/v1/accounts');
    expect(listed.status).toBe(200);
    expect(listed.body.data.pending[0].fullName).toBe('Staff Member');
    const id = listed.body.data.pending[0].id as string;
    await agent.post(`/api/v1/accounts/${id}/approve`);

    const staffAgent = request.agent(app);
    const signedIn = await staffAgent
      .post('/api/v1/auth/sign-in')
      .send({ email: STAFF, password: PASSWORD });
    expect(signedIn.status).toBe(200);

    const forbidden = await staffAgent.get('/api/v1/accounts');
    expect(forbidden.status).toBe(403);
    expect(forbidden.body.error.code).toBe('NOT_ALLOWED');
  });

  it('creates a public reset link and accepts it once', async () => {
    const context = setup();
    const { app } = context;
    await seedAccount(context, ADMIN);
    await seedAccount(context, STAFF);
    const agent = request.agent(app);
    await agent.post('/api/v1/auth/sign-in').send({ email: ADMIN, password: PASSWORD });
    const id = (await context.accounts.findByEmail(STAFF))!.id;

    const reset = await agent.post(`/api/v1/accounts/${id}/reset-password`);
    expect(reset.status).toBe(200);
    expect(reset.body.data.resetUrl).toMatch(/^http:\/\/localhost:5173\/reset-password\?token=/);

    const token = new URL(reset.body.data.resetUrl).searchParams.get('token')!;
    const set = await request(app)
      .post('/api/v1/auth/reset-password')
      .send({ token, newPassword: 'brand-new-pass' });
    expect(set.status).toBe(204);

    const again = await request(app)
      .post('/api/v1/auth/reset-password')
      .send({ token, newPassword: 'another-password' });
    expect(again.status).toBe(400);
    expect(again.body.error.code).toBe('RESET_TOKEN_INVALID');
  });
});

describe('invite and register HTTP', () => {
  const INVITED = 'ada@sourceone.global';
  const NOW = new Date('2026-10-16T12:00:00.000Z');
  const registration = {
    firstName: 'Ada',
    lastName: 'Lovelace',
    password: 'a-long-password',
    confirmPassword: 'a-long-password',
  };

  type Client = ReturnType<typeof request.agent> | ReturnType<typeof request>;

  async function signedIn(context: TestApp, email: string) {
    const agent = request.agent(context.app);
    const response = await agent.post('/api/v1/auth/sign-in').send({ email, password: PASSWORD });
    expect(response.status).toBe(200);
    return agent;
  }

  async function adminWithApp() {
    const context = setup();
    await seedAccount(context, ADMIN);
    return { ...context, admin: await signedIn(context, ADMIN) };
  }

  function tokenOf(inviteUrl: string): string {
    return new URL(inviteUrl).searchParams.get('token')!;
  }

  /** An invite added straight to the repository, for states the routes cannot reach at a fixed time. */
  async function seedInvite(
    context: TestApp,
    token: string,
    options: { createdAt?: Date; email?: string } = {},
  ): Promise<AccountInvite> {
    const invite = AccountInvite.create(
      options.email ?? INVITED,
      `hash(${token})`,
      '00000000-0000-4000-8000-000000000900',
      `00000000-0000-4000-8000-${String(token.length).padStart(12, '0')}`,
      options.createdAt ?? NOW,
    );
    await context.invites.add(invite);
    return invite;
  }

  it('creates an invite: 201 with the invite and a /register link to send', async () => {
    const { admin } = await adminWithApp();
    const created = await admin.post('/api/v1/accounts/invites').send({ email: 'Ada@SourceOne.Global' });

    expect(created.status).toBe(201);
    expect(created.body.data.invite).toEqual({
      id: expect.any(String),
      email: INVITED,
      expiresAt: new Date(NOW.getTime() + INVITE_TTL_MS).toISOString(),
    });
    expect(created.body.data.inviteUrl).toMatch(/^http:\/\/localhost:5173\/register\?token=.+/);
  });

  it('refuses to invite an address that is not @sourceone.global: 400 EMAIL_NOT_ALLOWED', async () => {
    const { admin } = await adminWithApp();
    const refused = await admin.post('/api/v1/accounts/invites').send({ email: 'ada@gmail.com' });
    expect(refused.status).toBe(400);
    expect(refused.body.error).toEqual({
      code: 'EMAIL_NOT_ALLOWED',
      message: 'Use a @sourceone.global email address.',
      details: { fields: { email: ['Use a @sourceone.global email address.'] } },
    });
  });

  it('refuses to invite an address that already has an account: 409 ACCOUNT_EXISTS', async () => {
    const context = await adminWithApp();
    await seedAccount(context, INVITED);
    const refused = await context.admin.post('/api/v1/accounts/invites').send({ email: 'ADA@sourceone.global' });
    expect(refused.status).toBe(409);
    expect(refused.body.error.code).toBe('ACCOUNT_EXISTS');
    expect(refused.body.error.message).toBe('An account already exists for that email.');
  });

  it('refuses an invite body without an email: 400 VALIDATION_FAILED', async () => {
    const { admin } = await adminWithApp();
    const refused = await admin.post('/api/v1/accounts/invites').send({});
    expect(refused.status).toBe(400);
    expect(refused.body.error.code).toBe('VALIDATION_FAILED');
  });

  it('lists the open invites, newest first', async () => {
    const context = await adminWithApp();
    await seedInvite(context, 'older', { email: 'older@sourceone.global', createdAt: new Date(NOW.getTime() - 60_000) });
    await seedInvite(context, 'expired', {
      email: 'expired@sourceone.global',
      createdAt: new Date(NOW.getTime() - INVITE_TTL_MS),
    });
    await context.admin.post('/api/v1/accounts/invites').send({ email: 'newer@sourceone.global' });

    const listed = await context.admin.get('/api/v1/accounts/invites');

    expect(listed.status).toBe(200);
    expect(listed.body.data.map((invite: { email: string }) => invite.email)).toEqual([
      'newer@sourceone.global',
      'older@sourceone.global',
    ]);
    expect(Object.keys(listed.body.data[0]).sort()).toEqual(['email', 'expiresAt', 'id']);
  });

  it('revokes an invite: 200, its link stops working, and a second revoke is 404 INVITE_NOT_FOUND', async () => {
    const { app, admin } = await adminWithApp();
    const created = await admin.post('/api/v1/accounts/invites').send({ email: INVITED });
    const id = created.body.data.invite.id as string;

    const revoked = await admin.post(`/api/v1/accounts/invites/${id}/revoke`);
    expect(revoked.status).toBe(200);
    expect(revoked.body.data).toEqual(created.body.data.invite);
    expect((await request(app).get(`/api/v1/auth/invites/${tokenOf(created.body.data.inviteUrl)}`)).status).toBe(404);

    const again = await admin.post(`/api/v1/accounts/invites/${id}/revoke`);
    expect(again.status).toBe(404);
    expect(again.body.error).toEqual({ code: 'INVITE_NOT_FOUND', message: 'This invite was already used or revoked.' });
  });

  it('refuses to revoke a used, unknown or malformed invite: 404 INVITE_NOT_FOUND', async () => {
    const { app, admin } = await adminWithApp();
    const created = await admin.post('/api/v1/accounts/invites').send({ email: INVITED });
    const id = created.body.data.invite.id as string;
    await request(app)
      .post('/api/v1/auth/register')
      .send({ token: tokenOf(created.body.data.inviteUrl), ...registration });

    for (const path of [id, '00000000-0000-4000-8000-0000000000ff', 'not-a-uuid']) {
      const refused = await admin.post(`/api/v1/accounts/invites/${path}/revoke`);
      expect(refused.status).toBe(404);
      expect(refused.body.error.code).toBe('INVITE_NOT_FOUND');
    }
  });

  it('keeps the invite routes from a signed-in non-admin (403) and from anyone signed out (401)', async () => {
    const context = await adminWithApp();
    await seedAccount(context, STAFF);
    const staff = await signedIn(context, STAFF);
    const routes = [
      (client: Client) => client.get('/api/v1/accounts/invites'),
      (client: Client) => client.post('/api/v1/accounts/invites').send({ email: INVITED }),
      (client: Client) => client.post('/api/v1/accounts/invites/00000000-0000-4000-8000-000000000001/revoke'),
    ];

    for (const route of routes) {
      const forbidden = await route(staff);
      expect(forbidden.status).toBe(403);
      expect(forbidden.body.error.code).toBe('NOT_ALLOWED');

      const signedOut = await route(request(context.app));
      expect(signedOut.status).toBe(401);
      expect(signedOut.body.error.code).toBe('SIGN_IN_REQUIRED');
    }
    expect(await context.invites.listOpen(NOW)).toEqual([]);
  });

  it('reads an invite publicly: 200 with its email and expiry, and nothing else', async () => {
    const { app, admin } = await adminWithApp();
    const created = await admin.post('/api/v1/accounts/invites').send({ email: INVITED });

    const read = await request(app).get(`/api/v1/auth/invites/${tokenOf(created.body.data.inviteUrl)}`);

    expect(read.status).toBe(200);
    expect(read.body.data).toEqual({ email: INVITED, expiresAt: created.body.data.invite.expiresAt });
  });

  it.each([
    'garbage',
    'x'.repeat(5000),
    '%E2%82%AC%20%3Cscript%3E',
    '%27%20or%201=1--',
    '..%2F..%2Fetc%2Fpasswd',
    '%',
    '%E0%A4%A',
  ])('answers 404 INVITE_INVALID to any garbage token: %s', async (token) => {
    const { app, logger } = setup();
    const read = await request(app).get(`/api/v1/auth/invites/${token}`);
    expect(read.status).toBe(404);
    expect(read.body.error).toEqual({ code: 'INVITE_INVALID', message: 'This invite link no longer works.' });
    expect(logger.errors).toEqual([]);
  });

  it('answers the same 404 INVITE_INVALID for an expired, used or revoked token', async () => {
    const context = setup();
    await seedInvite(context, 'expired', { createdAt: new Date(NOW.getTime() - INVITE_TTL_MS) });
    const used = await seedInvite(context, 'used-token', { email: 'used@sourceone.global' });
    const usedBy = Account.registerInvited(
      { email: 'used@sourceone.global', firstName: 'A', lastName: 'B', passwordHash: 'x', invitedBy: used.invitedBy },
      '00000000-0000-4000-8000-000000000777',
      NOW,
    );
    await context.invites.redeem(used.id, usedBy, NOW);
    const revoked = await seedInvite(context, 'revoked-token-x', { email: 'revoked@sourceone.global' });
    await context.invites.revoke(revoked.id, NOW);

    for (const token of ['expired', 'used-token', 'revoked-token-x']) {
      const read = await request(context.app).get(`/api/v1/auth/invites/${token}`);
      expect(read.status).toBe(404);
      expect(read.body.error.code).toBe('INVITE_INVALID');

      const registered = await request(context.app).post('/api/v1/auth/register').send({ token, ...registration });
      expect(registered.status).toBe(404);
      expect(registered.body.error.code).toBe('INVITE_INVALID');
    }
  });

  it('makes the first link answer 404 INVITE_INVALID once a second invite to the same email is created', async () => {
    const { app, admin } = await adminWithApp();
    const first = await admin.post('/api/v1/accounts/invites').send({ email: INVITED });
    await admin.post('/api/v1/accounts/invites').send({ email: INVITED });

    const read = await request(app).get(`/api/v1/auth/invites/${tokenOf(first.body.data.inviteUrl)}`);
    expect(read.status).toBe(404);
    expect(read.body.error.code).toBe('INVITE_INVALID');
  });

  it('registers: 201 with an approved account, no session cookie, and it can sign in at once', async () => {
    const { app, admin } = await adminWithApp();
    const created = await admin.post('/api/v1/accounts/invites').send({ email: INVITED });

    const registered = await request(app)
      .post('/api/v1/auth/register')
      .send({ token: tokenOf(created.body.data.inviteUrl), ...registration });

    expect(registered.status).toBe(201);
    expect(registered.headers['set-cookie']).toBeUndefined();
    expect(registered.body.data).toMatchObject({
      email: INVITED,
      firstName: 'Ada',
      lastName: 'Lovelace',
      fullName: 'Ada Lovelace',
      status: 'approved',
      mustChangePassword: false,
      isAdmin: false,
    });

    const signIn = await request(app).post('/api/v1/auth/sign-in').send({ email: INVITED, password: 'a-long-password' });
    expect(signIn.status).toBe(200);
    expect(signIn.body.data.fullName).toBe('Ada Lovelace');
  });

  it('creates the account with the email of the invite, ignoring an email in the body', async () => {
    const context = await adminWithApp();
    const created = await context.admin.post('/api/v1/accounts/invites').send({ email: INVITED });

    const registered = await request(context.app)
      .post('/api/v1/auth/register')
      .send({ token: tokenOf(created.body.data.inviteUrl), email: 'someone-else@sourceone.global', ...registration });

    expect(registered.status).toBe(201);
    expect(registered.body.data.email).toBe(INVITED);
    expect(await context.accounts.findByEmail('someone-else@sourceone.global')).toBeNull();
  });

  it('refuses passwords that differ: 400 VALIDATION_FAILED under confirmPassword, and creates nothing', async () => {
    const context = await adminWithApp();
    const created = await context.admin.post('/api/v1/accounts/invites').send({ email: INVITED });

    const refused = await request(context.app)
      .post('/api/v1/auth/register')
      .send({ token: tokenOf(created.body.data.inviteUrl), ...registration, confirmPassword: 'another-password' });

    expect(refused.status).toBe(400);
    expect(refused.body.error.code).toBe('VALIDATION_FAILED');
    expect(refused.body.error.details).toEqual({ fields: { confirmPassword: ["The passwords don't match."] } });
    expect(await context.accounts.findByEmail(INVITED)).toBeNull();
  });

  it('refuses a body of the wrong shape: 400 VALIDATION_FAILED', async () => {
    const { app } = setup();
    const refused = await request(app).post('/api/v1/auth/register').send({ token: 'token-1', firstName: 'Ada' });
    expect(refused.status).toBe(400);
    expect(refused.body.error.code).toBe('VALIDATION_FAILED');
  });

  it('answers 404 INVITE_INVALID to registering with an unknown or empty token', async () => {
    const { app } = setup();
    for (const token of ['unknown', '']) {
      const refused = await request(app).post('/api/v1/auth/register').send({ token, ...registration });
      expect(refused.status).toBe(404);
      expect(refused.body.error.code).toBe('INVITE_INVALID');
    }
  });

  it('refuses to register when the email got an account since: 409 ACCOUNT_EXISTS, and the link still works', async () => {
    const context = await adminWithApp();
    const created = await context.admin.post('/api/v1/accounts/invites').send({ email: INVITED });
    await seedAccount(context, INVITED);
    const token = tokenOf(created.body.data.inviteUrl);

    const refused = await request(context.app).post('/api/v1/auth/register').send({ token, ...registration });

    expect(refused.status).toBe(409);
    expect(refused.body.error.code).toBe('ACCOUNT_EXISTS');
    expect((await request(context.app).get(`/api/v1/auth/invites/${token}`)).status).toBe(200);
  });

  it('answers 404 INVITE_INVALID to a second registration on the same link', async () => {
    const { app, admin } = await adminWithApp();
    const created = await admin.post('/api/v1/accounts/invites').send({ email: INVITED });
    const token = tokenOf(created.body.data.inviteUrl);
    await request(app).post('/api/v1/auth/register').send({ token, ...registration });

    const again = await request(app).post('/api/v1/auth/register').send({ token, ...registration });
    expect(again.status).toBe(404);
    expect(again.body.error.code).toBe('INVITE_INVALID');
  });
});
