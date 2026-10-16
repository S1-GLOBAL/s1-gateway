import { Router } from 'express';
import type { AuthController } from './auth.controller.js';

export function createPublicAuthRouter(controller: AuthController): Router {
  const router = Router();
  router.post('/sign-up', controller.signUpHandler);
  router.post('/sign-in', controller.signInHandler);
  router.post('/reset-password', controller.resetPasswordHandler);
  router.get('/invites/:token', controller.getInviteHandler);
  router.use('/invites', controller.undecodableInviteHandler);
  router.post('/register', controller.registerHandler);
  return router;
}

export function createSessionAuthRouter(controller: AuthController): Router {
  const router = Router();
  router.get('/me', controller.meHandler);
  router.post('/sign-out', controller.signOutHandler);
  router.post('/change-password', controller.changePasswordHandler);
  return router;
}
