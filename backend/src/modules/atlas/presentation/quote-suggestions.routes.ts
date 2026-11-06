import { Router } from 'express';
import type { QuoteSuggestionsController } from './quote-suggestions.controller.js';

/**
 * Adding quotations to Spec IDs (plan 0017, ADR 0035), mounted on `/atlas`
 * for every signed-in staff member, with the manufacturers a quotation may
 * choose. Nothing here changes a Spec ID's quotes: approving and rejecting
 * are admins', in `createQuoteSuggestionsAdminRouter`. `waiting-count` comes
 * before `:id`, which it would otherwise match.
 */
export function createQuoteSuggestionsRouter(controller: QuoteSuggestionsController): Router {
  const router = Router();
  router.get('/manufacturers', controller.manufacturers);
  router.get('/quote-suggestions/waiting-count', controller.waitingCount);
  router.get('/quote-suggestions', controller.list);
  router.post('/quote-suggestions', controller.suggest);
  router.get('/quote-suggestions/:id', controller.get);
  router.put('/quote-suggestions/:id', controller.edit);
  router.post('/quote-suggestions/:id/withdraw', controller.withdraw);
  return router;
}

/**
 * Deciding a quotation, mounted on `/atlas` behind the admin gate (ADR 0030):
 * anyone else is answered 403 before any Atlas code runs. Nobody decides
 * their own; the use cases refuse that.
 */
export function createQuoteSuggestionsAdminRouter(controller: QuoteSuggestionsController): Router {
  const router = Router();
  router.post('/quote-suggestions/:id/approve', controller.approve);
  router.post('/quote-suggestions/:id/reject', controller.reject);
  return router;
}
