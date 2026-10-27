import { Router } from 'express';
import type { AtlasController } from './atlas.controller.js';

/**
 * The dictionary is only read here: it changes when an admin approves a
 * suggestion, on `/atlas/dictionary` (ADR 0031). A saved Spec ID is created, read and
 * changed, never deleted (ADR 0022): there is no DELETE. Every signed-in staff
 * member may call these; the one PUT, a manufacturer's stage, is admins' only
 * and lives in `createAtlasAdminRouter` (#57).
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
  router.get('/saved/:id/manufacturers', controller.manufacturers);
  return router;
}

/**
 * Atlas routes only admins may call, mounted behind the admin gate (ADR 0027):
 * setting or clearing a manufacturer's stage on a Spec ID (#57).
 */
export function createAtlasAdminRouter(controller: AtlasController): Router {
  const router = Router();
  router.put('/saved/:id/manufacturers/:manufacturerId/stage', controller.setManufacturerStage);
  return router;
}
