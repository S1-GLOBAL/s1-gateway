import { Router } from 'express';
import type { AtlasController } from './atlas.controller.js';

/** Reading only: nothing here updates or deletes a dictionary value (ADR 0021). */
export function createAtlasRouter(controller: AtlasController): Router {
  const router = Router();
  router.get('/dictionary', controller.dictionary);
  router.post('/spec-ids/decode', controller.decode);
  router.post('/spec-ids/encode', controller.encode);
  return router;
}
