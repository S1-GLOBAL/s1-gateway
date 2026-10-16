import request from 'supertest';
import { describe, expect, it } from 'vitest';
import {
  FixedClock,
  RecordingLogger,
  SequentialIdGenerator,
} from '../../../shared/application/testing/fakes.js';
import type { UseCase } from '../../../shared/application/use-case.js';
import { createApp } from '../../../shared/presentation/http/create-app.js';
import { CreateTool } from '../application/create-tool.js';
import { ListTools } from '../application/list-tools.js';
import { InMemoryToolRepository } from '../application/testing/in-memory-tool-repository.js';
import type { ToolDto } from '../application/tool.dto.js';
import { ToolsController } from './tools.controller.js';
import { createToolsRouter } from './tools.routes.js';

const payroll = { name: 'Payroll', url: 'https://payroll.example.com', category: 'Finance' };

function setup(listTools?: UseCase<void, ToolDto[]>) {
  const repository = new InMemoryToolRepository();
  const logger = new RecordingLogger();
  const controller = new ToolsController(
    listTools ?? new ListTools(repository),
    new CreateTool(repository, new FixedClock(new Date('2026-10-14T08:00:00.000Z')), new SequentialIdGenerator()),
  );
  // Tools route shape only — production mounts tools behind the session gate.
  const app = createApp({
    modules: [{ path: '/tools', router: createToolsRouter(controller), access: 'public' }],
    logger,
    corsOrigin: 'http://localhost:5173',
  });
  return { app, logger };
}

describe('POST /api/v1/tools', () => {
  it('creates a tool and answers 201 with it', async () => {
    const { app } = setup();
    const response = await request(app).post('/api/v1/tools').send(payroll);
    expect(response.status).toBe(201);
    expect(response.body).toEqual({
      data: {
        id: '00000000-0000-4000-8000-000000000001',
        name: 'Payroll',
        url: 'https://payroll.example.com',
        description: '',
        category: 'Finance',
        createdAt: '2026-10-14T08:00:00.000Z',
      },
    });
  });

  it('answers 400 VALIDATION_FAILED with the field for a broken rule', async () => {
    const { app } = setup();
    const response = await request(app).post('/api/v1/tools').send({ ...payroll, url: 'javascript:alert(1)' });
    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('VALIDATION_FAILED');
    expect(response.body.error.details.fields.url).toEqual([expect.any(String)]);
  });

  it('answers 400 VALIDATION_FAILED for a missing field', async () => {
    const { app } = setup();
    const response = await request(app).post('/api/v1/tools').send({ name: 'Payroll', url: payroll.url });
    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('VALIDATION_FAILED');
    expect(response.body.error.details.fields.category).toEqual([expect.any(String)]);
  });

  it('answers 400 VALIDATION_FAILED when there is no body at all', async () => {
    const { app } = setup();
    const response = await request(app).post('/api/v1/tools');
    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('VALIDATION_FAILED');
  });

  it('answers 400 MALFORMED_JSON for a body that is not JSON', async () => {
    const { app } = setup();
    const response = await request(app)
      .post('/api/v1/tools')
      .set('Content-Type', 'application/json')
      .send('{"name":');
    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('MALFORMED_JSON');
  });

  it('answers 415 in the error shape for a charset the body parser cannot read', async () => {
    const { app, logger } = setup();
    const response = await request(app)
      .post('/api/v1/tools')
      .set('Content-Type', 'application/json; charset=latin1')
      .send(JSON.stringify(payroll));
    expect(response.status).toBe(415);
    expect(response.body.error.code).toBe('UNSUPPORTED_MEDIA_TYPE');
    expect(logger.errors).toHaveLength(0);
  });

  it('answers 413 PAYLOAD_TOO_LARGE for a body over the limit', async () => {
    const { app } = setup();
    const response = await request(app)
      .post('/api/v1/tools')
      .send({ ...payroll, description: 'd'.repeat(110_000) });
    expect(response.status).toBe(413);
    expect(response.body.error.code).toBe('PAYLOAD_TOO_LARGE');
  });

  it('answers 409 TOOL_NAME_TAKEN for a name taken in another case', async () => {
    const { app } = setup();
    await request(app).post('/api/v1/tools').send(payroll);
    const response = await request(app).post('/api/v1/tools').send({ ...payroll, name: '  PAYROLL ' });
    expect(response.status).toBe(409);
    expect(response.body.error.code).toBe('TOOL_NAME_TAKEN');
    expect(response.body.error.details.fields.name).toEqual([expect.any(String)]);
  });
});

describe('GET /api/v1/tools', () => {
  it('lists what was created', async () => {
    const { app } = setup();
    await request(app).post('/api/v1/tools').send(payroll);
    const response = await request(app).get('/api/v1/tools');
    expect(response.status).toBe(200);
    expect(response.body.data.map((tool: ToolDto) => tool.name)).toEqual(['Payroll']);
  });

  it('answers a generic 500 for an unexpected failure, and logs it', async () => {
    const failing: UseCase<void, ToolDto[]> = {
      execute: () => Promise.reject(new Error('connection refused at 10.0.0.5')),
    };
    const { app, logger } = setup(failing);
    const response = await request(app).get('/api/v1/tools');
    expect(response.status).toBe(500);
    expect(response.body).toEqual({
      error: { code: 'INTERNAL_ERROR', message: 'Something went wrong. Try again later.' },
    });
    expect(logger.errors).toHaveLength(1);
  });
});
