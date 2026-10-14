import type { Router } from 'express';

/** What a module hands the composition root: where to mount it, and its routes. */
export interface HttpModule {
  readonly path: string;
  readonly router: Router;
}
