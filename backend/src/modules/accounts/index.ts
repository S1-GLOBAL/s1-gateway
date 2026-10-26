import type { Clock } from '../../shared/application/ports/clock.js';
import type { IdGenerator } from '../../shared/application/ports/id-generator.js';
import type { Database } from '../../shared/infrastructure/database/connection.js';
import type { HttpModule } from '../../shared/presentation/http/http-module.js';
import { ApproveAccount } from './application/approve-account.js';
import { ChangePassword } from './application/change-password.js';
import { CreateInvite } from './application/create-invite.js';
import { CreatePasswordResetLink } from './application/create-password-reset-link.js';
import { DisableAccount } from './application/disable-account.js';
import { GetInvite } from './application/get-invite.js';
import { GetMe } from './application/get-me.js';
import { ListAccounts } from './application/list-accounts.js';
import { ListInvites } from './application/list-invites.js';
import { RegisterWithInvite } from './application/register-with-invite.js';
import { ResetPasswordWithToken } from './application/reset-password-with-token.js';
import { RevokeInvite } from './application/revoke-invite.js';
import { SeedSystemAdmins } from './application/seed-system-admins.js';
import { SetAccountRole } from './application/set-account-role.js';
import { SignIn } from './application/sign-in.js';
import { SignOut } from './application/sign-out.js';
import { DrizzleAccountInviteRepository } from './infrastructure/drizzle-account-invite-repository.js';
import { DrizzleAccountRepository } from './infrastructure/drizzle-account-repository.js';
import { DrizzlePasswordResetTokenRepository } from './infrastructure/drizzle-password-reset-token-repository.js';
import { DrizzleSessionRepository } from './infrastructure/drizzle-session-repository.js';
import { RandomTokenGenerator } from './infrastructure/random-token-generator.js';
import { ScryptPasswordHasher } from './infrastructure/scrypt-password-hasher.js';
import { AccountsController } from './presentation/accounts.controller.js';
import { createAccountsRouter } from './presentation/accounts.routes.js';
import { AuthController } from './presentation/auth.controller.js';
import { createPublicAuthRouter, createSessionAuthRouter } from './presentation/auth.routes.js';
import { createAdminGate, createSessionGate, type SessionGateDeps } from './presentation/session-gate.js';

export interface AccountsModuleDependencies {
  db: Database;
  clock: Clock;
  ids: IdGenerator;
  corsOrigin: string;
  cookieSecure: boolean;
}

export interface AccountsHttpBundle {
  modules: HttpModule[];
  sessionGate: ReturnType<typeof createSessionGate>;
  adminGate: ReturnType<typeof createAdminGate>;
}

/** The module's composition root: adapters meet use cases; returns auth + accounts modules. */
export function buildAccountsModule(deps: AccountsModuleDependencies): AccountsHttpBundle {
  const accounts = new DrizzleAccountRepository(deps.db);
  const sessions = new DrizzleSessionRepository(deps.db);
  const resetTokens = new DrizzlePasswordResetTokenRepository(deps.db);
  const invites = new DrizzleAccountInviteRepository(deps.db);
  const passwordHasher = new ScryptPasswordHasher();
  const tokens = new RandomTokenGenerator();

  const authController = new AuthController(
    new SignIn(accounts, sessions, passwordHasher, tokens, deps.clock, deps.ids),
    new SignOut(sessions, tokens),
    new GetMe(accounts, sessions, tokens, deps.clock),
    new ChangePassword(accounts, sessions, passwordHasher, tokens, deps.clock),
    new ResetPasswordWithToken(accounts, resetTokens, sessions, passwordHasher, tokens, deps.clock),
    deps.cookieSecure,
    {
      get: new GetInvite(invites, tokens, deps.clock),
      register: new RegisterWithInvite(invites, passwordHasher, tokens, deps.clock, deps.ids),
    },
  );

  const accountsController = new AccountsController(
    new ListAccounts(accounts),
    new ApproveAccount(accounts, deps.clock),
    new DisableAccount(accounts, sessions),
    new CreatePasswordResetLink(accounts, resetTokens, sessions, tokens, deps.clock, deps.ids),
    new SetAccountRole(accounts),
    deps.corsOrigin,
    {
      create: new CreateInvite(accounts, invites, tokens, deps.clock, deps.ids),
      list: new ListInvites(invites, deps.clock),
      revoke: new RevokeInvite(invites, deps.clock),
    },
  );

  const gateDeps: SessionGateDeps = {
    findSessionByTokenHash: (hash) => sessions.findByTokenHash(hash),
    saveSession: (session) => sessions.save(session),
    findAccountById: (id) => accounts.findById(id),
    hashToken: (token) => tokens.hash(token),
    clock: deps.clock,
    cookieSecure: deps.cookieSecure,
  };

  return {
    modules: [
      { path: '/auth', router: createPublicAuthRouter(authController), access: 'public' },
      { path: '/auth', router: createSessionAuthRouter(authController), access: 'session' },
      { path: '/accounts', router: createAccountsRouter(accountsController), access: 'admin' },
    ],
    sessionGate: createSessionGate(gateDeps),
    adminGate: createAdminGate(),
  };
}

/**
 * Run once as the API starts: while no account is a System Admin, makes each
 * approved account in `ACCOUNT_ADMIN_EMAILS` one (ADR 0030). Returns the
 * emails it promoted.
 */
export function seedSystemAdmins(db: Database, emails: readonly string[]): Promise<string[]> {
  return new SeedSystemAdmins(new DrizzleAccountRepository(db)).execute({ emails });
}

/** The accounts table, for another module's foreign key and joins (atlas). Nothing else. */
export { accounts as accountsTable } from './infrastructure/accounts.table.js';
/** The signed-in account of a request behind the session gate; throws 401 SIGN_IN_REQUIRED without one. */
export { requireAuth } from './presentation/session-gate.js';
