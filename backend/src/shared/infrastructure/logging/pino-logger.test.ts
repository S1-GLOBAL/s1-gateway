import express from 'express';
import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';
import { createPino, createRequestLogger } from './pino-logger.js';

/** Invented values, shaped like the real ones. */
const TOKEN = 'invented-session-token-HLs0123456789abcdef';
const SIGNATURE = 'invented-proxy-signature-0123456789abcdef';
const INVITE_TOKEN = 'invented-invite-token-Qx0123456789abcdef';

/** Collects every line the logger writes. */
function captureLines() {
  const lines: string[] = [];
  return { lines, destination: { write: (line: string) => void lines.push(line) } };
}

/** An app with the request logger in front, as `main.ts` wires it. */
function appWithRequestLogger(destination: { write: (line: string) => void }) {
  const app = express();
  app.use(createRequestLogger(createPino({ level: 'info', pretty: false }, destination)));
  return app;
}

/** The request logger's line for the one request made. */
async function completedEntry(lines: string[]) {
  await vi.waitFor(() => expect(lines.some((line) => line.includes('request completed'))).toBe(true));
  return JSON.parse(lines.find((line) => line.includes('request completed')) ?? '{}');
}

/** One public read of an invite, whose link carries its token in the path. */
async function logOneInviteRead() {
  const { lines, destination } = captureLines();
  const app = appWithRequestLogger(destination);
  app.get('/api/v1/auth/invites/:token', (_req, res) => {
    res.json({ data: {} });
  });

  await request(app).get(`/api/v1/auth/invites/${INVITE_TOKEN}`);

  const entry = await completedEntry(lines);
  return { output: lines.join(''), entry };
}

/** One request through the request logger, as `main.ts` wires it, signed in and renewing its session. */
async function logOneSignedInRequest() {
  const { lines, destination } = captureLines();
  const app = appWithRequestLogger(destination);
  app.get('/api/v1/auth/me', (_req, res) => {
    res.cookie('s1_gateway_session', TOKEN, { httpOnly: true });
    res.json({ data: {} });
  });

  await request(app)
    .get('/api/v1/auth/me')
    .set('Cookie', `s1_gateway_session=${TOKEN}`)
    .set('Authorization', `Bearer ${TOKEN}`)
    .set('x-vercel-proxy-signature', `Bearer ${SIGNATURE}`)
    .set('x-forwarded-for', '203.0.113.7');

  const entry = await completedEntry(lines);
  return { output: lines.join(''), entry };
}

describe('createPino', () => {
  it('writes no session token and no proxy signature to the logs', async () => {
    const { output } = await logOneSignedInRequest();

    expect(output).not.toContain(TOKEN);
    expect(output).not.toContain(SIGNATURE);
  });

  it('replaces each credential header with [Redacted]', async () => {
    const { entry } = await logOneSignedInRequest();

    expect(entry.req.headers.cookie).toBe('[Redacted]');
    expect(entry.req.headers.authorization).toBe('[Redacted]');
    expect(entry.req.headers['x-vercel-proxy-signature']).toBe('[Redacted]');
    expect(entry.res.headers['set-cookie']).toBe('[Redacted]');
  });

  it('keeps the client IP and the rest of the request, for tracing and debugging', async () => {
    const { entry } = await logOneSignedInRequest();

    expect(entry.req.headers['x-forwarded-for']).toBe('203.0.113.7');
    expect(entry.req.method).toBe('GET');
    expect(entry.req.url).toBe('/api/v1/auth/me');
    expect(entry.res.statusCode).toBe(200);
  });

  it('writes no invite token, which an invite link carries in its path', async () => {
    const { output, entry } = await logOneInviteRead();

    expect(output).not.toContain(INVITE_TOKEN);
    expect(entry.req.url).toBe('/api/v1/auth/invites/[Redacted]');
  });
});
