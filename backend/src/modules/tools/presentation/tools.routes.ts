import { Router } from 'express';
import type { ToolsController } from './tools.controller.js';

export function createToolsRouter(controller: ToolsController): Router {
  const router = Router();
  router.get('/', controller.list);
  router.post('/', controller.create);
  return router;
}
