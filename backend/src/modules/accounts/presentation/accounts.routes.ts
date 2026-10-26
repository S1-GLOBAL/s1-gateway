import { Router } from 'express';
import type { AccountsController } from './accounts.controller.js';

/**
 * `/invites` has one segment and `/invites/:id/revoke` three, so neither can
 * be read as `/:id/approve` or its two-segment siblings, whatever the order.
 */
export function createAccountsRouter(controller: AccountsController): Router {
  const router = Router();
  router.get('/', controller.list);
  router.post('/:id/approve', controller.approve);
  router.post('/:id/disable', controller.disable);
  router.post('/:id/reset-password', controller.resetPassword);
  router.put('/:id/role', controller.setRole);
  router.get('/invites', controller.listInvites);
  router.post('/invites', controller.createInvite);
  router.post('/invites/:id/revoke', controller.revokeInvite);
  return router;
}
