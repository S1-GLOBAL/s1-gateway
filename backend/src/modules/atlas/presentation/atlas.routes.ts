import { Router } from 'express';
import type { AtlasController } from './atlas.controller.js';

/** Saving and reading only: no route updates or deletes a dictionary value or a saved Spec ID (ADR 0021). */
export function createAtlasRouter(controller: AtlasController): Router {
  const router = Router();
  router.get('/dictionary', controller.dictionary);
  router.post('/spec-ids/decode', controller.decode);
  router.post('/spec-ids/encode', controller.encode);
  router.post('/spec-ids', controller.save);
  router.get('/spec-ids', controller.findSimilar);
  router.get('/spec-ids/:code', controller.findByCode);
  return router;
}
