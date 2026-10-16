import { Router } from 'express';
import type { AccountsController } from './accounts.controller.js';

export function createAccountsRouter(controller: AccountsController): Router {
  const router = Router();
  router.get('/', controller.list);
  router.post('/:id/approve', controller.approve);
  router.post('/:id/disable', controller.disable);
  router.post('/:id/reset-password', controller.resetPassword);
  return router;
}
