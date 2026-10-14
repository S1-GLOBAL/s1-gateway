#!/usr/bin/env node
/**
 * Takes a screenshot of the running app in a headless Chrome or Edge, driven
 * over the DevTools protocol. No dependency: Node 22+ ships `fetch` and
 * `WebSocket`, and the machine already has a browser.
 *
 * For looking at a screen, not for testing behaviour — that is what the unit
 * tests are for. Point it only at a LOCAL server (`npm run preview` in
 * frontend/). Adapted from Bilikha's scripts/screenshot.mjs.
 *
 *   node scripts/screenshot.mjs '{"url":"http://localhost:4173/theme","out":"shot.png",
 *                                 "w":1440,"h":900,"scheme":"dark",
 *                                 "seed":{"key":"s1-gateway.theme","value":"dark"},
 *                                 "click":["text=Theme"],"hover":"a[href='/theme']",
 *                                 "evaluate":"document.title"}'
 *
 * Every field but `url` and `out` is optional:
 *   w, h        viewport in CSS pixels (default 1440 x 900)
 *   scheme      the OS colour scheme to emulate, "light" or "dark" (default light)
 *   media       further media features, e.g. {"prefers-reduced-motion":"reduce"}
 *   seed        writes one localStorage key on the origin, then reloads
 *   settle      ms to wait after loading (default 2500)
 *   click       a selector, or "text=Label", or an array of them, run in order
 *   hover       a selector to move the mouse onto just before the shot
 *   evaluate    a JS expression; its result is printed
 *
 * The browser always exits, even when a step fails.
 */
import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const spec = JSON.parse(process.argv[2] ?? '{}');
if (!spec.url || !spec.out) {
  console.error('usage: node scripts/screenshot.mjs \'{"url":"http://localhost:4173/","out":"shot.png"}\'');
  process.exit(2);
}

const CANDIDATES = [
  process.env.BROWSER,
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
].filter(Boolean);
const BROWSER = CANDIDATES.find((path) => existsSync(path));
if (!BROWSER) {
  console.error('No Chrome or Edge found. Set BROWSER to the browser executable.');
  process.exit(2);
}

const PORT = 9335;
const profile = join(tmpdir(), 's1-gateway-screenshot-profile');
mkdirSync(profile, { recursive: true });
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const browser = spawn(
  BROWSER,
  [
    '--headless=new',
    '--disable-gpu',
    '--no-first-run',
    '--no-default-browser-check',
    `--remote-debugging-port=${PORT}`,
    `--user-data-dir=${profile}`,
    'about:blank',
  ],
  { stdio: 'ignore' },
);

let exitCode = 0;
try {
  await run();
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  exitCode = 1;
} finally {
  browser.kill();
}
process.exit(exitCode);

async function run() {
  const ws = new WebSocket(await debuggerUrl());
  await new Promise((resolve, reject) => {
    ws.onopen = resolve;
    ws.onerror = reject;
  });

  let nextId = 0;
  const pending = new Map();
  ws.onmessage = (event) => {
    const message = JSON.parse(event.data);
    if (message.id && pending.has(message.id)) pending.get(message.id)(message.result ?? {});
  };
  const send = (method, params = {}) =>
    new Promise((resolve) => {
      nextId += 1;
      pending.set(nextId, resolve);
      ws.send(JSON.stringify({ id: nextId, method, params }));
    });
  const evaluate = async (expression) =>
    (await send('Runtime.evaluate', { expression, returnByValue: true }))?.result?.value;

  await send('Page.enable');
  await send('Runtime.enable');

  const width = spec.w ?? 1440;
  const height = spec.h ?? 900;
  await send('Emulation.setDeviceMetricsOverride', {
    width,
    height,
    deviceScaleFactor: spec.dsf ?? 2,
    mobile: width < 768,
  });
  await send('Emulation.setEmulatedMedia', {
    features: [
      { name: 'prefers-color-scheme', value: spec.scheme ?? 'light' },
      ...Object.entries(spec.media ?? {}).map(([name, value]) => ({ name, value })),
    ],
  });

  if (spec.seed) {
    await send('Page.navigate', { url: spec.url });
    await wait(1500);
    await evaluate(
      `try { localStorage.setItem(${JSON.stringify(spec.seed.key)}, ${JSON.stringify(spec.seed.value)}) } catch (e) {}`,
    );
  }

  await send('Page.navigate', { url: spec.url });
  await wait(spec.settle ?? 2500);

  for (const target of [].concat(spec.click ?? [])) {
    const result = await evaluate(
      target.startsWith('text=')
        ? `(() => { const t = ${JSON.stringify(target.slice(5))};
            const el = Array.from(document.querySelectorAll('a,button,[role=tab],[role=radio],label'))
              .find((e) => e.textContent.trim() === t || e.getAttribute('aria-label') === t);
            if (!el) return 'NOT FOUND: ' + t; el.click(); return 'clicked: ' + t; })()`
        : `(() => { const el = document.querySelector(${JSON.stringify(target)});
            if (!el) return 'NOT FOUND: ' + ${JSON.stringify(target)}; el.click(); return 'clicked'; })()`,
    );
    console.log('click:', result);
    await wait(spec.afterClick ?? 1200);
  }

  if (spec.hover) {
    const box = await evaluate(
      `(() => { const el = document.querySelector(${JSON.stringify(spec.hover)});
        if (!el) return null; const r = el.getBoundingClientRect();
        return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; })()`,
    );
    if (!box) throw new Error(`hover target not found: ${spec.hover}`);
    await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: box.x, y: box.y });
    await wait(spec.afterHover ?? 250);
  }

  if (spec.evaluate) console.log('eval:', JSON.stringify(await evaluate(spec.evaluate)));

  const { data } = await send('Page.captureScreenshot', { format: 'png' });
  writeFileSync(spec.out, Buffer.from(data, 'base64'));
  console.log(`saved ${spec.out}  ${width}x${height}  scheme:${spec.scheme ?? 'light'}`);
  ws.close();
}

async function debuggerUrl() {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    try {
      const targets = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();
      const page = targets.find((t) => t.type === 'page');
      if (page) return page.webSocketDebuggerUrl;
    } catch {
      // The browser is still starting.
    }
    await wait(250);
  }
  throw new Error('The browser did not open a debugging port.');
}
