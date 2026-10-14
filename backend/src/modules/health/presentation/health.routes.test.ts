import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { silentLogger } from '../../../shared/application/testing/fakes.js';
import { createApp } from '../../../shared/presentation/http/create-app.js';
import { buildHealthModule } from '../index.js';

const app = createApp({
  modules: [buildHealthModule()],
  logger: silentLogger,
  corsOrigin: 'http://localhost:5173',
});

describe('GET /api/v1/health', () => {
  it('answers ok in the data envelope', async () => {
    const response = await request(app).get('/api/v1/health');
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ data: { status: 'ok' } });
  });
});

describe('an unknown route', () => {
  it('answers 404 in the error shape', async () => {
    const response = await request(app).get('/api/v1/nothing-here');
    expect(response.status).toBe(404);
    expect(response.body.error.code).toBe('NOT_FOUND');
    expect(typeof response.body.error.message).toBe('string');
  });
});
