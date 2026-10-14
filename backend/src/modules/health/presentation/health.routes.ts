import { Router } from 'express';
import type { Health } from '../../../contracts/health.js';
import { sendData } from '../../../shared/presentation/http/respond.js';

export function createHealthRouter(): Router {
  const router = Router();
  router.get('/', (_req, res) => {
    const health: Health = { status: 'ok' };
    sendData(res, 200, health);
  });
  return router;
}
