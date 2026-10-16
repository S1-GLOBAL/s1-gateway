import 'dotenv/config';
import { pinoHttp } from 'pino-http';
import { composeApp } from './compose.js';
import { parseEnv } from './shared/infrastructure/config/env.js';
import { CryptoIdGenerator } from './shared/infrastructure/crypto-id-generator.js';
import { connectDatabase } from './shared/infrastructure/database/connection.js';
import { createPino, PinoLogger } from './shared/infrastructure/logging/pino-logger.js';
import { SystemClock } from './shared/infrastructure/system-clock.js';

const parsed = parseEnv(process.env);
if (!parsed.ok) {
  console.error('Invalid environment — check backend/.env against backend/.env.example:');
  for (const line of parsed.error) console.error(`  ${line}`);
  process.exit(1);
}
const env = parsed.value;

const pino = createPino({ level: env.LOG_LEVEL, pretty: env.NODE_ENV === 'development' });
const logger = new PinoLogger(pino);
const database = connectDatabase(env.DATABASE_URL);

const app = composeApp({
  db: database.db,
  logger,
  clock: new SystemClock(),
  ids: new CryptoIdGenerator(),
  corsOrigin: env.CORS_ORIGIN,
  accountAdminEmails: env.accountAdminEmails,
  cookieSecure: env.NODE_ENV === 'production',
  requestLogger: pinoHttp({ logger: pino }),
});

const server = app.listen(env.PORT, () => {
  logger.info(`s1-gateway API listening on http://localhost:${env.PORT}`, { env: env.NODE_ENV });
});

/**
 * Stop taking connections, let in-flight requests finish, then release the
 * pool. The ceiling keeps a stuck request from blocking a deploy forever.
 */
function shutdown(signal: string): void {
  logger.info(`${signal} received, shutting down`);
  const forceExit = setTimeout(() => process.exit(1), 10_000);
  forceExit.unref();

  server.close(() => {
    database.close().then(
      () => process.exit(0),
      (error: unknown) => {
        logger.error('Error while closing the database', { err: error });
        process.exit(1);
      },
    );
  });
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
