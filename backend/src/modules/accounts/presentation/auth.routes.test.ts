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
import { CreatePasswordResetLink } from '../application/create-password-reset-link.js';
import { DisableAccount } from '../application/disable-account.js';
import { GetMe } from '../application/get-me.js';
import { ListAccounts } from '../application/list-accounts.js';
import { ResetPasswordWithToken } from '../application/reset-password-with-token.js';
import { SignIn } from '../application/sign-in.js';
import { SignOut } from '../application/sign-out.js';
import { SignUp } from '../application/sign-up.js';
import { FakePasswordHasher } from '../application/testing/fake-password-hasher.js';
import { FakeTokenGenerator } from '../application/testing/fake-token-generator.js';
import { InMemoryAccountRepository } from '../application/testing/in-memory-account-repository.js';
import { InMemoryPasswordResetTokenRepository } from '../application/testing/in-memory-password-reset-token-repository.js';
import { InMemorySessionRepository } from '../application/testing/in-memory-session-repository.js';
import { InMemorySignUpRateLimiter } from '../application/testing/in-memory-sign-up-rate-limiter.js';
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
  const hasher = new FakePasswordHasher();
  const tokens = new FakeTokenGenerator();
  const clock = new FixedClock(new Date('2026-10-16T12:00:00.000Z'));
  const ids = new SequentialIdGenerator();
  const adminEmails = [ADMIN];

  const authController = new AuthController(
    new SignUp(accounts, new InMemorySignUpRateLimiter(), hasher, clock, ids, adminEmails),
    new SignIn(accounts, sessions, hasher, tokens, clock, ids),
    new SignOut(sessions, tokens),
    new GetMe(accounts, sessions, tokens, clock),
    new ChangePassword(accounts, sessions, hasher, tokens, clock),
    new ResetPasswordWithToken(accounts, resetTokens, hasher, tokens, clock),
    adminEmails,
    false,
  );

  const accountsController = new AccountsController(
    new ListAccounts(accounts),
    new ApproveAccount(accounts, clock),
    new DisableAccount(accounts, sessions),
    new CreatePasswordResetLink(accounts, resetTokens, sessions, tokens, clock, ids),
    adminEmails,
    'http://localhost:5173',
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
  };

  const app = createApp({
    logger: new RecordingLogger(),
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

  return { app };
}

describe('auth and accounts HTTP', () => {
  it('keeps health public and tools behind a session', async () => {
    const { app } = setup();
    expect((await request(app).get('/api/v1/health')).status).toBe(200);
    const tools = await request(app).get('/api/v1/tools');
    expect(tools.status).toBe(401);
    expect(tools.body.error.code).toBe('SIGN_IN_REQUIRED');
  });

  it('signs up an admin (auto-approved), signs in, and reaches tools', async () => {
    const { app } = setup();
    const agent = request.agent(app);
    const signedUp = await agent
      .post('/api/v1/auth/sign-up')
      .send({ email: ADMIN, fullName: 'Admin User', password: PASSWORD });
    expect(signedUp.status).toBe(201);
    expect(signedUp.body.data.status).toBe('approved');
    expect(signedUp.headers['set-cookie']).toBeUndefined();

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

    expect((await agent.get('/api/v1/tools')).status).toBe(200);
  });

  it('keeps a pending staff account from signing in until approved', async () => {
    const { app } = setup();
    const agent = request.agent(app);
    await agent.post('/api/v1/auth/sign-up').send({ email: ADMIN, fullName: 'Admin', password: PASSWORD });
    await agent.post('/api/v1/auth/sign-in').send({ email: ADMIN, password: PASSWORD });

    const pending = await agent
      .post('/api/v1/auth/sign-up')
      .send({ email: STAFF, fullName: 'Staff Member', password: PASSWORD });
    expect(pending.status).toBe(201);
    expect(pending.body.data.status).toBe('pending');

    const blocked = await request(app)
      .post('/api/v1/auth/sign-in')
      .send({ email: STAFF, password: PASSWORD });
    expect(blocked.status).toBe(403);
    expect(blocked.body.error.code).toBe('ACCOUNT_PENDING');
    expect(blocked.headers['set-cookie']).toBeUndefined();

    const listed = await agent.get('/api/v1/accounts');
    expect(listed.status).toBe(200);
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
    const { app } = setup();
    const agent = request.agent(app);
    await agent.post('/api/v1/auth/sign-up').send({ email: ADMIN, fullName: 'Admin', password: PASSWORD });
    await agent.post('/api/v1/auth/sign-in').send({ email: ADMIN, password: PASSWORD });
    await agent.post('/api/v1/auth/sign-up').send({ email: STAFF, fullName: 'Staff', password: PASSWORD });
    const listed = await agent.get('/api/v1/accounts');
    const id = listed.body.data.pending[0].id as string;
    await agent.post(`/api/v1/accounts/${id}/approve`);

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
