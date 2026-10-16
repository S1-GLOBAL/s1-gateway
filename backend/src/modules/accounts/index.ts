import type { Clock } from '../../shared/application/ports/clock.js';
import type { IdGenerator } from '../../shared/application/ports/id-generator.js';
import type { Database } from '../../shared/infrastructure/database/connection.js';
import type { HttpModule } from '../../shared/presentation/http/http-module.js';
import { ApproveAccount } from './application/approve-account.js';
import { ChangePassword } from './application/change-password.js';
import { CreatePasswordResetLink } from './application/create-password-reset-link.js';
import { DisableAccount } from './application/disable-account.js';
import { GetMe } from './application/get-me.js';
import { ListAccounts } from './application/list-accounts.js';
import { ResetPasswordWithToken } from './application/reset-password-with-token.js';
import { SignIn } from './application/sign-in.js';
import { SignOut } from './application/sign-out.js';
import { SignUp } from './application/sign-up.js';
import { DrizzleAccountRepository } from './infrastructure/drizzle-account-repository.js';
import { DrizzlePasswordResetTokenRepository } from './infrastructure/drizzle-password-reset-token-repository.js';
import { DrizzleSessionRepository } from './infrastructure/drizzle-session-repository.js';
import { RandomTokenGenerator } from './infrastructure/random-token-generator.js';
import { ScryptPasswordHasher } from './infrastructure/scrypt-password-hasher.js';
import { SlidingWindowSignUpRateLimiter } from './infrastructure/sliding-window-sign-up-rate-limiter.js';
import { AccountsController } from './presentation/accounts.controller.js';
import { createAccountsRouter } from './presentation/accounts.routes.js';
import { AuthController } from './presentation/auth.controller.js';
import { createPublicAuthRouter, createSessionAuthRouter } from './presentation/auth.routes.js';
import { createAdminGate, createSessionGate, type SessionGateDeps } from './presentation/session-gate.js';

export interface AccountsModuleDependencies {
  db: Database;
  clock: Clock;
  ids: IdGenerator;
  accountAdminEmails: readonly string[];
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
  const passwordHasher = new ScryptPasswordHasher();
  const tokens = new RandomTokenGenerator();
  const rateLimiter = new SlidingWindowSignUpRateLimiter();

  const authController = new AuthController(
    new SignUp(accounts, rateLimiter, passwordHasher, deps.clock, deps.ids, deps.accountAdminEmails),
    new SignIn(accounts, sessions, passwordHasher, tokens, deps.clock, deps.ids),
    new SignOut(sessions, tokens),
    new GetMe(accounts, sessions, tokens, deps.clock),
    new ChangePassword(accounts, sessions, passwordHasher, tokens, deps.clock),
    new ResetPasswordWithToken(accounts, resetTokens, passwordHasher, tokens, deps.clock),
    deps.accountAdminEmails,
    deps.cookieSecure,
  );

  const accountsController = new AccountsController(
    new ListAccounts(accounts),
    new ApproveAccount(accounts, deps.clock),
    new DisableAccount(accounts, sessions),
    new CreatePasswordResetLink(accounts, resetTokens, sessions, tokens, deps.clock, deps.ids),
    deps.accountAdminEmails,
    deps.corsOrigin,
  );

  const gateDeps: SessionGateDeps = {
    findSessionByTokenHash: (hash) => sessions.findByTokenHash(hash),
    saveSession: (session) => sessions.save(session),
    findAccountById: (id) => accounts.findById(id),
    hashToken: (token) => tokens.hash(token),
    clock: deps.clock,
    accountAdminEmails: deps.accountAdminEmails,
  };

  return {
    modules: [
      { path: '/auth', router: createPublicAuthRouter(authController), access: 'public' },
      { path: '/auth', router: createSessionAuthRouter(authController), access: 'session' },
      { path: '/accounts', router: createAccountsRouter(accountsController), access: 'admin' },
    ],
    sessionGate: createSessionGate(gateDeps),
    adminGate: createAdminGate(gateDeps),
  };
}
