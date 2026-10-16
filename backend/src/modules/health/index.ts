import type { HttpModule } from '../../shared/presentation/http/http-module.js';
import { createHealthRouter } from './presentation/health.routes.js';

/** Liveness only. Health has no rules, so it has only a presentation layer. */
export function buildHealthModule(): HttpModule {
  return { path: '/health', router: createHealthRouter(), access: 'public' };
}
