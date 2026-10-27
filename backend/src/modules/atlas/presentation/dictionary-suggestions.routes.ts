import { Router } from 'express';
import type { DictionarySuggestionsController } from './dictionary-suggestions.controller.js';

/**
 * Suggesting changes to the dictionary (#95, ADR 0031), mounted on
 * `/atlas/dictionary` for every signed-in staff member. Nothing here changes
 * the dictionary: approving and rejecting are admins', in
 * `createDictionarySuggestionsAdminRouter`. `waiting-count` comes before
 * `:id`, which it would otherwise match.
 */
export function createDictionarySuggestionsRouter(controller: DictionarySuggestionsController): Router {
  const router = Router();
  router.get('/usage/:slot/:code', controller.usage);
  router.get('/suggestions/waiting-count', controller.waitingCount);
  router.get('/suggestions', controller.list);
  router.post('/suggestions', controller.suggest);
  router.get('/suggestions/:id', controller.get);
  router.put('/suggestions/:id', controller.edit);
  router.post('/suggestions/:id/withdraw', controller.withdraw);
  return router;
}

/**
 * Deciding a suggestion, mounted on `/atlas/dictionary` behind the admin gate
 * (ADR 0030): anyone else is answered 403 before any Atlas code runs. Nobody
 * decides their own; the use cases refuse that.
 */
export function createDictionarySuggestionsAdminRouter(controller: DictionarySuggestionsController): Router {
  const router = Router();
  router.post('/suggestions/:id/approve', controller.approve);
  router.post('/suggestions/:id/reject', controller.reject);
  return router;
}
