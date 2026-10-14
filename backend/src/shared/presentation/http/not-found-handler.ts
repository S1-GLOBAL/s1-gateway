import type { RequestHandler } from 'express';
import { sendError } from './respond.js';

export const notFoundHandler: RequestHandler = (req, res) => {
  sendError(res, 404, 'NOT_FOUND', `No route for ${req.method} ${req.path}.`);
};
