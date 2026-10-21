import { Router } from 'express';
import type { AtlasController } from './atlas.controller.js';

/**
 * The dictionary is only read (ADR 0021). A saved Spec ID is created, read and
 * changed, never deleted (ADR 0022): there is no PUT and no DELETE.
 */
export function createAtlasRouter(controller: AtlasController): Router {
  const router = Router();
  router.get('/dictionary', controller.dictionary);
  router.post('/spec-ids/decode', controller.decode);
  router.post('/spec-ids/encode', controller.encode);
  router.post('/spec-ids/read', controller.readText);
  router.post('/spec-ids', controller.save);
  router.get('/spec-ids', controller.findSimilar);
  router.get('/spec-ids/:code', controller.findByCode);
  router.get('/saved', controller.library);
  router.get('/saved/:id', controller.getSaved);
  router.patch('/saved/:id', controller.update);
  router.get('/saved/:id/history', controller.history);
  return router;
}
