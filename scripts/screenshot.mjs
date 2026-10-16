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
 *   cookies     [{name,value,domain?,path?,httpOnly?,secure?,sameSite?}] set before navigate
 *   settle      ms to wait after loading (default 2500)
 *   loadTimeout ms to wait for document complete + page text (default 30000)
 *   readyText   substring that must appear in body text before settle (optional)
 *   click       a selector, or "text=Label", or an array of them, run in order
 *   hover       a selector to move the mouse onto just before the shot
 *   evaluate    a JS expression; its result is printed
 *   awaitPromise  set true when evaluate returns a Promise
 *
 * The browser always exits, even when a step fails.
 */
import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const arg = process.argv[2] ?? '{}';
const spec = JSON.parse(arg.endsWith('.json') && existsSync(arg) ? readFileSync(arg, 'utf8') : arg);
if (!spec.url || !spec.out) {
  console.error(
    'usage: node scripts/screenshot.mjs \'{"url":"http://localhost:4173/","out":"shot.png"}\'\n' +
      '   or: node scripts/screenshot.mjs path/to/spec.json',
  );
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

const PORT = 9300 + Math.floor(Math.random() * 600);
const profile = join(tmpdir(), `s1-gateway-screenshot-profile-${PORT}`);
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
  const evaluate = async (expression, awaitPromise = false) =>
    (await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise }))?.result
      ?.value;

  await send('Page.enable');
  await send('Runtime.enable');
  await send('Network.enable');

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

  for (const cookie of [].concat(spec.cookies ?? [])) {
    const result = await send('Network.setCookie', {
      name: cookie.name,
      value: cookie.value,
      url: cookie.url ?? spec.url,
      path: cookie.path ?? '/',
      httpOnly: cookie.httpOnly ?? true,
      secure: cookie.secure ?? false,
      sameSite: cookie.sameSite ?? 'Lax',
    });
    if (!result.success) {
      throw new Error(`Network.setCookie failed for ${cookie.name}: ${JSON.stringify(result)}`);
    }
  }

  const navigateAndWait = async (url) => {
    await send('Page.navigate', { url });
    // Wait for the load event, then for real page text. Vite's first compile of
    // a lazy route can take several seconds; skeleton markup alone is not ready
    // (accounts stays on skeletons until /auth/me returns).
    const readyText = spec.readyText ?? '';
    const deadline = Date.now() + (spec.loadTimeout ?? 30000);
    while (Date.now() < deadline) {
      const state = await evaluate(
        `(() => ({
          ready: document.readyState,
          text: (document.body && document.body.innerText || '').trim()
        }))()`,
      );
      const text = state?.text ?? '';
      const hasMarker = !readyText || text.includes(readyText);
      if (state?.ready === 'complete' && text.length > 20 && hasMarker) break;
      await wait(250);
    }
    await wait(spec.settle ?? 2500);
  };

  if (spec.seed) {
    await navigateAndWait(spec.url);
    await evaluate(
      `try { localStorage.setItem(${JSON.stringify(spec.seed.key)}, ${JSON.stringify(spec.seed.value)}) } catch (e) {}`,
    );
  }

  await navigateAndWait(spec.url);

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

  if (spec.evaluate) {
    const value = await evaluate(spec.evaluate, Boolean(spec.awaitPromise));
    console.log('eval:', JSON.stringify(value));
  }

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
