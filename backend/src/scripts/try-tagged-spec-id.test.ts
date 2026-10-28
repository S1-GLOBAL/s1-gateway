/**
 * Local trial of the tagged Spec ID. Not part of the Gateway.
 *
 *   npx tsx src/scripts/try-tagged-spec-id.test.ts
 *
 * Opens nothing by itself. Prints the address, then serves a page on
 * 127.0.0.1 where a code can be pasted.
 */
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Dictionary } from '../modules/atlas/domain/dictionary.js';
import { SlotNumbering, TaggedSpecId, describeTagged, taggedDictionary, watchTagged, type TaggedCodeVersion } from '../modules/atlas/domain/tagged-spec-id.js';
import { COMBINED_PRODUCT_TYPES, combinedProductRules } from '../modules/atlas/domain/tagged-combined-products.js';
import { S2_0_1_0_RULES, S2_0_1_0_VALUES, s2Dictionary } from '../modules/atlas/domain/testing/s2-dictionary.js';

const PORT = 5191;
const issued = s2Dictionary();
const taggedValues = [...S2_0_1_0_VALUES, ...COMBINED_PRODUCT_TYPES];
const dictionary = new Dictionary(issued.release, issued.approvedOn, taggedValues, [...S2_0_1_0_RULES, ...combinedProductRules(issued)]);
const numbering = SlotNumbering.fromIssuance(taggedValues);

const CUP = 'CUP.BCS.Y.WH.RD.X.Z0012.0090.Y.0110.X.X.X.Y.Y.Y.DW.02.X.X.X.X.X.X.X';

export interface TaggedTrial {
  readonly inputLength: number;
  readonly ok: true;
  readonly code: string;
  readonly summary: string;
  readonly facts: readonly { readonly name: string; readonly meaning: string }[];
}

export interface TaggedTrialRefusal {
  readonly inputLength: number;
  readonly ok: false;
  readonly problems: readonly string[];
}

export function tryTagged(input: string, version: TaggedCodeVersion = 'v1'): TaggedTrial | TaggedTrialRefusal {
  const result = TaggedSpecId.read(input, dictionary, numbering, version);
  if (!result.ok) return { inputLength: input.trim().length, ok: false, problems: result.error.problems };
  return trialOf(input, result.value);
}

function trialOf(input: string, value: TaggedSpecId): TaggedTrial {
  return {
    inputLength: input.trim().length,
    ok: true,
    code: value.code,
    summary: value.summary(dictionary),
    facts: value
      .describe(dictionary)
      .filter((slot) => slot.state === 'value')
      .map((slot) => ({ name: slot.name, meaning: slot.meaning })),
  };
}

function examples(): { label: string; code: string }[] {
  const cup = tryTagged(CUP, 'v2');
  return [
    { label: "Today's cup", code: CUP },
    { label: 'This cup', code: cup.ok ? cup.code : CUP },
    { label: 'Missing value', code: 'B17A' },
    { label: 'Bag with a diameter', code: 'A16B6H90' },
    { label: 'Paper cold cup', code: '22oz White Single Wall Paper Cold Cup (2-3 color print)' },
  ];
}

function escapeHtml(value: string): string {
  return value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');
}

function dictionaryHtml(): string {
  return taggedDictionary(taggedValues, numbering, 'v2')
    .map((group) => {
      const entries = group.entries
        .map((entry) => {
          const former = entry.former === undefined ? '' : ` <span class="former">${escapeHtml(entry.former)}</span>`;
          return `<li><code>${escapeHtml(entry.code)}</code><span>${escapeHtml(entry.meaning)}${former}</span></li>`;
        })
        .join('');
      return `<section class="group"><h3>${escapeHtml(group.title)}</h3><ul class="entries">${entries}</ul></section>`;
    })
    .join('');
}

function page(): string {
  const samples = JSON.stringify(examples());
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Tagged Spec ID</title>
  <style>
    body { margin: 0; background: #f4f5f1; color: #1c1e1a; font: 15px/1.4 "Segoe UI", ui-sans-serif, system-ui, sans-serif; }
    main { max-width: 44rem; margin: 0 auto; padding: 1.25rem 1.25rem 2rem; }
    h1 { font-size: 1.25rem; font-weight: 650; margin: 0 0 0.25rem; }
    h2 { font-size: 1.15rem; font-weight: 650; margin: 1.75rem 0 0.2rem; }
    h3 { font-size: 0.95rem; font-weight: 650; margin: 0 0 0.3rem; }
    a { color: inherit; }
    .note { margin: 0 0 0.75rem; color: #4a4e46; }
    form.search { display: flex; gap: 0.4rem; align-items: center; margin: 0; }
    form.search input { flex: 1; min-width: 0; height: 2.4rem; margin: 0; box-sizing: border-box; padding: 0.35rem 0.7rem; border: 1px solid #c8cdc2; border-radius: 6px; background: #fff; color: #1c1e1a; font: 14px/1.4 ui-monospace, Consolas, monospace; }
    .row { display: flex; flex-wrap: wrap; gap: 0.4rem; margin: 0.6rem 0 0; }
    button { font: inherit; height: 2.4rem; padding: 0.35rem 0.7rem; border: 1px solid #c8cdc2; border-radius: 6px; background: #fff; color: #1c1e1a; cursor: pointer; }
    button.primary { background: #1c1e1a; color: #fff; border-color: #1c1e1a; }
    #out { margin-top: 0.75rem; padding: 0.7rem 0.85rem; background: #fff; color: #1c1e1a; border: 1px solid #c8cdc2; border-radius: 6px; }
    #out p { margin: 0.2rem 0; }
    #out code { font: 15px/1.4 ui-monospace, Consolas, monospace; font-weight: 650; }
    #out ul { margin: 0.35rem 0 0; padding-left: 1.15rem; }
    #out li { margin: 0.05rem 0; }
    #out li.warn { color: #8a4b08; }
    #out li.warn ul { margin: 0.1rem 0 0.15rem; padding-left: 1.05rem; list-style: circle; }
    #out li.warn li { margin: 0; }
    #out .aside { color: #4a4e46; }
    .group { margin-top: 0.85rem; }
    .entries { display: grid; grid-template-columns: repeat(auto-fill, minmax(17rem, 1fr)); gap: 0.12rem 1.25rem; margin: 0; padding: 0; list-style: none; }
    .entries li { display: flex; gap: 0.55rem; align-items: baseline; }
    .entries code { flex: 0 0 4.25rem; font: 13px/1.4 ui-monospace, Consolas, monospace; font-weight: 650; }
    .former { color: #6b7066; }
  </style>
</head>
<body>
  <main>
    <h1>Tagged Spec ID</h1>
    <p class="note">One letter per key, in slot order. A is product type, B is material, C is coating, D is colour. Capacity is G, and its first digit is the unit. A product description works in the same box. <a href="#dictionary">Dictionary</a></p>
    <form class="search" id="search">
      <input id="code" name="code" type="text" spellcheck="false" autocomplete="off" placeholder="A5B17D3E1Q2R3-G112H90J110">
      <button class="primary" type="submit">Search</button>
    </form>
    <div class="row" id="samples"></div>
    <div id="out"><p>Search a code, or paste a description.</p></div>
    <h2 id="dictionary">Dictionary</h2>
    <p class="note">S2 0.1.0, numbered in the order each value was issued. The old letter code follows the meaning.</p>
    <div id="dict">${dictionaryHtml()}</div>
  </main>
  <script>
    const samples = ${samples};
    const form = document.querySelector('#search');
    const code = document.querySelector('#code');
    const out = document.querySelector('#out');
    const row = document.querySelector('#samples');
    for (const sample of samples) {
      const button = document.createElement('button');
      button.type = 'button';
      button.textContent = sample.label;
      button.addEventListener('click', () => { code.value = sample.code; void watch(); });
      row.append(button);
    }
    form.addEventListener('submit', (event) => {
      event.preventDefault();
      void watch();
    });
    code.addEventListener('input', () => { void watch(); });
    function warningItem(warning) {
      const item = document.createElement('li');
      item.className = 'warn';
      const options = splitOptions(warning);
      if (!options) {
        item.textContent = warning;
        return item;
      }
      item.append(document.createTextNode(options.lead));
      const nested = document.createElement('ul');
      for (const option of options.options) {
        const child = document.createElement('li');
        child.textContent = option;
        nested.append(child);
      }
      item.append(nested);
      return item;
    }
    function splitOptions(warning) {
      const matched = warning.match(/^(.*matches \\d+ entries): (.*)$/);
      if (matched) {
        const options = matched[2].replace(/\\.$/, '').split('. ').filter(Boolean);
        if (options.length >= 2) return { lead: matched[1] + '.', options: options };
      }
      const parts = warning.split('. ').map(function (part, index, all) {
        return index === all.length - 1 ? part.replace(/\\.$/, '') : part;
      });
      const first = parts.findIndex(function (part) { return / is [A-Z]\\d+$/.test(part); });
      if (first <= 0) return null;
      const options = parts.slice(first);
      const listed = options.every(function (part) { return / is [A-Z]\\d+$/.test(part); });
      if (!listed || options.length < 2) return null;
      return { lead: parts.slice(0, first).join('. ') + '.', options: options };
    }
    function show(nodes) {
      out.replaceChildren();
      for (const node of nodes) out.append(node);
    }
    let watchId = 0;
    async function watch() {
      const typed = code.value;
      const current = ++watchId;
      if (typed.trim() === '') {
        const hint = document.createElement('p');
        hint.textContent = 'Search a code, or paste a description.';
        show([hint]);
        return;
      }
      let body;
      try {
        const prose = /[A-Za-z]{2,}/.test(typed);
        const response = await fetch(prose ? '/describe' : '/watch', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(prose ? { text: typed } : { code: typed }),
        });
        body = await response.json();
      } catch (error) {
        if (current !== watchId) return;
        const line = document.createElement('p');
        line.textContent = 'The page could not reach the trial. ' + error;
        show([line]);
        return;
      }
      if (current !== watchId) return;
      const nodes = [];
      if (body.code) {
        const line = document.createElement('p');
        const written = document.createElement('code');
        written.textContent = body.code;
        line.append(written);
        nodes.push(line);
      }
      if (body.warnings.length > 0) {
        const warnings = document.createElement('ul');
        for (const warning of body.warnings) warnings.append(warningItem(warning));
        nodes.push(warnings);
      }
      if (body.facts.length > 0) {
        const list = document.createElement('ul');
        for (const fact of body.facts) {
          const item = document.createElement('li');
          item.textContent = fact.name + ': ' + fact.meaning;
          list.append(item);
        }
        nodes.push(list);
      }
      if (body.ignored && body.ignored.length > 0) {
        const aside = document.createElement('p');
        aside.className = 'aside';
        aside.textContent = 'Left out: ' + body.ignored.join(', ');
        nodes.push(aside);
      }
      if (nodes.length === 0) {
        const hint = document.createElement('p');
        hint.textContent = 'Search a code, or paste a description.';
        nodes.push(hint);
      }
      show(nodes);
    }
  </script>
</body>
</html>`;
}

function send(response: ServerResponse, status: number, body: string, type: string): void {
  response.writeHead(status, { 'content-type': type, 'cache-control': 'no-store' });
  response.end(body);
}

async function readBody(request: IncomingMessage): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of request) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  return Buffer.concat(chunks).toString('utf8');
}

function listen(): Promise<void> {
  const server = createServer((request, response) => {
    void handle(request, response);
  });
  return new Promise((resolveListen, reject) => {
    server.once('error', reject);
    server.listen(PORT, '127.0.0.1', () => {
      console.log(`Tagged Spec ID trial at http://127.0.0.1:${PORT}`);
      resolveListen();
    });
  });
}

async function handle(request: IncomingMessage, response: ServerResponse): Promise<void> {
  const url = request.url ?? '/';
  if (request.method === 'GET' && (url === '/' || url === '' || url.startsWith('/?'))) {
    send(response, 200, page(), 'text/html; charset=utf-8');
    return;
  }
  if (request.method === 'POST' && url === '/describe') {
    const raw = await readBody(request);
    try {
      const parsed: unknown = JSON.parse(raw);
      if (parsed !== null && typeof parsed === 'object' && 'text' in parsed && typeof parsed.text === 'string') {
        send(response, 200, JSON.stringify(describeTagged(parsed.text, dictionary, numbering)), 'application/json');
        return;
      }
    } catch {
      // The same 400 as a body that is not JSON.
    }
    send(response, 400, JSON.stringify({ code: null, warnings: ['Send { "text": "..." }.'], facts: [], ignored: [] }), 'application/json');
    return;
  }
  if (request.method === 'POST' && url === '/watch') {
    const raw = await readBody(request);
    try {
      const parsed: unknown = JSON.parse(raw);
      if (parsed !== null && typeof parsed === 'object' && 'code' in parsed && typeof parsed.code === 'string') {
        send(response, 200, JSON.stringify(watchTagged(parsed.code, dictionary, numbering, 'v2')), 'application/json');
        return;
      }
    } catch {
      // The same 400 as a body that is not JSON.
    }
    send(response, 400, JSON.stringify({ warnings: ['Send { "code": "..." }.'], facts: [] }), 'application/json');
    return;
  }
  if (request.method === 'POST' && url === '/read') {
    const raw = await readBody(request);
    let code = '';
    try {
      const parsed: unknown = JSON.parse(raw);
      if (parsed !== null && typeof parsed === 'object' && 'code' in parsed && typeof parsed.code === 'string') {
        code = parsed.code;
        send(response, 200, JSON.stringify(tryTagged(code, 'v2')), 'application/json');
        return;
      } else {
        send(response, 400, JSON.stringify({ ok: false, problems: ['Send { "code": "..." }.'], inputLength: 0 }), 'application/json');
        return;
      }
    } catch {
      send(response, 400, JSON.stringify({ ok: false, problems: ['Send { "code": "..." }.'], inputLength: 0 }), 'application/json');
      return;
    }
  }
  send(response, 404, 'Not found', 'text/plain; charset=utf-8');
}

function isCommand(): boolean {
  const entry = process.argv[1];
  return entry !== undefined && resolve(entry).toLowerCase() === fileURLToPath(import.meta.url).toLowerCase();
}

if (process.env.VITEST === 'true') {
  const { describe, expect, it } = await import('vitest');
  describe('tagged Spec ID trial', () => {
    it('reads the cup into the short code', () => {
      const cup = tryTagged(CUP);
      expect(cup.ok).toBe(true);
      if (!cup.ok) return;
      expect(cup.code.startsWith('PT5M17CL3')).toBe(true);
      expect(cup.summary).toContain('Cup');
    });

    it('reads the same cup in v2 letters', () => {
      const cup = tryTagged(CUP, 'v2');
      expect(cup.ok).toBe(true);
      if (!cup.ok) return;
      expect(cup.code.startsWith('A5B17D3')).toBe(true);
      expect(cup.facts.some((fact) => fact.meaning === 'Cup')).toBe(true);
      const found = tryTagged('A4B5', 'v2');
      expect(found.ok).toBe(true);
      if (!found.ok) return;
      expect(found.facts).toEqual([
        { name: 'Product type', meaning: 'Stand-up pouch' },
        { name: 'Material', meaning: 'Polymer, EPS foam' },
      ]);
    });

    it('reads a short code as itself', () => {
      const found = tryTagged('PT4M5');
      expect(found.ok).toBe(true);
      if (!found.ok) return;
      expect(found.code).toBe('PT4M5');
      expect(found.facts).toEqual([
        { name: 'Product type', meaning: 'Stand-up pouch' },
        { name: 'Material', meaning: 'Polymer, EPS foam' },
      ]);
    });

    it('names a tag that has no value', () => {
      const refused = tryTagged('M17PTCL3');
      expect(refused.ok).toBe(false);
      if (refused.ok) return;
      expect(refused.problems[0]).toContain('Product type (PT) has no value');
    });
  });
}

if (isCommand()) {
  listen().catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  });
}
