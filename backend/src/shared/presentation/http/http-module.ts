import type { Router } from 'express';

export type HttpAccess = 'public' | 'session' | 'admin';

/**
 * What a module hands the composition root: where to mount it, its routes,
 * and who may call them. Default `session` so a forgotten flag does not leave
 * a data route open.
 */
export interface HttpModule {
  readonly path: string;
  readonly router: Router;
  readonly access?: HttpAccess;
}
