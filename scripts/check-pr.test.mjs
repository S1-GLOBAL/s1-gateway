import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { auditPullRequest } from './check-pr.mjs';

const TEMPLATE = readFileSync(new URL('../.github/pull_request_template.md', import.meta.url), 'utf8');

/** A description that fills in every required section. */
const COMPLETE = `
## What and why

Lets staff pin one tool to the top of the Tools page.

Plan / issue: docs/plans/0003-pinned-tools.md

## Acceptance criteria

- [x] Staff can pin one tool

## What changed

- **Database:** none
- **API:** none
- **UI:** none
- **Config:** none

## How to verify

1. Open Tools and pin a tool.

## Rollout

- [x] No migration
- [x] No new environment variable
- [x] No one-off script

## Known gaps and risks

None.

## Checklist

- [x] One feature
- [x] Checks pass locally
`;

const STATES_DONE = `
## States checked

- [x] Empty, loading and error states
- [ ] Phone width (390px) with the bottom bar — n/a, a desktop-only setting

## Screenshots

![tool card, dark](https://example.com/shot.png)
`;

const UI = ['frontend/src/pages/tools/ToolsPage.tsx', 'frontend/src/pages/tools/ToolsPage.test.tsx'];

const files = (...paths) => paths.map((path) => ({ status: 'M', path }));
const has = (problems, fragment) => problems.some((problem) => problem.includes(fragment));

test('a complete description with a docs-only diff passes', () => {
  assert.deepEqual(auditPullRequest({ body: COMPLETE, files: files('docs/guides/x.md') }), []);
});

test('the untouched template fails on every required section', () => {
  const problems = auditPullRequest({ body: TEMPLATE, files: files('docs/guides/x.md') });
  for (const title of ['What and why', 'Acceptance criteria', 'How to verify', 'Known gaps and risks']) {
    assert.ok(has(problems, `"${title}" section is empty`), title);
  }
  assert.ok(has(problems, '"Plan / issue:" is blank'));
  assert.ok(has(problems, '"Rollout" has unticked boxes'));
  assert.ok(has(problems, '"Checklist" has unticked boxes'));
  assert.ok(has(problems, 'leaves **Database** blank'));
});

test('a deleted section is reported as missing', () => {
  const body = COMPLETE.replace(/## Known gaps and risks\n\nNone\.\n/, '');
  assert.ok(has(auditPullRequest({ body, files: [] }), '"Known gaps and risks" section is missing'));
});

test('acceptance criteria must be a checkable list', () => {
  const body = COMPLETE.replace('- [x] Staff can pin one tool', 'It works.');
  assert.ok(has(auditPullRequest({ body, files: [] }), 'no checkable item'));
});

test('a UI change needs states and a screenshot', () => {
  const problems = auditPullRequest({ body: COMPLETE, files: files(...UI) });
  assert.ok(has(problems, '"States checked" is required'));
  assert.ok(has(problems, '"Screenshots" needs at least one image'));
});

test('a UI change with states and a screenshot passes, n/a lines allowed', () => {
  assert.deepEqual(auditPullRequest({ body: COMPLETE + STATES_DONE, files: files(...UI) }), []);
});

test('an unchecked state without n/a fails', () => {
  const body = COMPLETE + STATES_DONE.replace('- [x] Empty', '- [ ] Empty');
  assert.ok(has(auditPullRequest({ body, files: files(...UI) }), '1 unchecked state'));
});

test('code without a test fails, unless an exception gives a reason', () => {
  const code = files('backend/src/modules/tools/application/pin-tool.ts');
  assert.ok(has(auditPullRequest({ body: COMPLETE, files: code }), 'no test did'));
  assert.ok(has(auditPullRequest({ body: `${COMPLETE}\nNo tests: n/a\n`, files: code }), 'no test did'), 'too short');
  assert.deepEqual(
    auditPullRequest({ body: `${COMPLETE}\nNo tests: a rename with no behaviour change\n`, files: code }),
    [],
  );
});

test('a table change needs a migration', () => {
  const schema = files(
    'backend/src/modules/tools/infrastructure/tools.table.ts',
    'backend/src/modules/tools/infrastructure/drizzle-tool-repository.db.test.ts',
  );
  assert.ok(has(auditPullRequest({ body: COMPLETE, files: schema }), 'no migration'));
  assert.deepEqual(
    auditPullRequest({ body: COMPLETE, files: [...schema, { status: 'A', path: 'backend/drizzle/0001_pins.sql' }] }),
    [],
  );
});

test('adding a table to database-schema.ts also needs a migration', () => {
  const schema = files('backend/src/database-schema.ts', 'backend/src/compose.db.test.ts');
  assert.ok(has(auditPullRequest({ body: COMPLETE, files: schema }), 'no migration'));
});

test('a route change needs the API reference', () => {
  const routes = files(
    'backend/src/modules/tools/presentation/tools.routes.ts',
    'backend/src/modules/tools/presentation/tools.routes.test.ts',
  );
  assert.ok(has(auditPullRequest({ body: COMPLETE, files: routes }), 'api.md did not'));
  assert.deepEqual(auditPullRequest({ body: COMPLETE, files: [...routes, ...files('docs/reference/api.md')] }), []);
});

test('an env schema change needs .env.example and the environment reference', () => {
  const env = files(
    'backend/src/shared/infrastructure/config/env.ts',
    'backend/src/shared/infrastructure/config/env.test.ts',
    'backend/.env.example',
  );
  assert.ok(has(auditPullRequest({ body: COMPLETE, files: env }), 'env.ts changed'));
  assert.deepEqual(
    auditPullRequest({ body: COMPLETE, files: [...env, ...files('docs/reference/environment.md')] }),
    [],
  );
});

test('a lockfile that changed alone fails, unless it is declared', () => {
  const lock = files('backend/package-lock.json');
  assert.ok(has(auditPullRequest({ body: COMPLETE, files: lock }), 'package.json did not'));
  assert.deepEqual(auditPullRequest({ body: COMPLETE, files: [...lock, ...files('backend/package.json')] }), []);
  assert.deepEqual(
    auditPullRequest({ body: `${COMPLETE}\nLockfile only: npm audit fix for a patched esbuild\n`, files: lock }),
    [],
  );
});

test('environment files, scratch output and cookie jars are refused', () => {
  const problems = auditPullRequest({
    body: COMPLETE,
    files: files('backend/.env', 'frontend/.env.local', 'tmp/run.json', 'tmp-login.json', 'session.cookies'),
  });
  assert.equal(problems.filter((problem) => problem.includes('must not be committed')).length, 5);
});

test('.env.example is allowed, and deleting a forbidden file is fine', () => {
  assert.deepEqual(auditPullRequest({ body: COMPLETE, files: files('backend/.env.example') }), []);
  assert.deepEqual(auditPullRequest({ body: COMPLETE, files: [{ status: 'D', path: 'tmp/old.json' }] }), []);
});

test('template comments do not count as content', () => {
  const body = COMPLETE.replace('None.', '<!-- nothing to say -->');
  assert.ok(has(auditPullRequest({ body, files: [] }), '"Known gaps and risks" section is empty'));
});

test('AI attribution in the description fails', () => {
  for (const line of ['🤖 Generated with [Claude Code](https://claude.com/claude-code)', 'Co-Authored-By: Claude <noreply@anthropic.com>', 'Assisted by Cursor']) {
    const body = COMPLETE.replace('None.', `None.\n\n${line}`);
    assert.ok(has(auditPullRequest({ body, files: [] }), 'credits an AI tool'), line);
  }
});

test('a human co-author, and attribution inside a template comment, pass', () => {
  for (const extra of ['Co-authored-by: Rey Denzo <rey@example.com>', '<!-- No AI attribution: no "Generated with Claude" footer -->']) {
    const body = COMPLETE.replace('None.', `None.\n\n${extra}`);
    assert.deepEqual(auditPullRequest({ body, files: [] }), [], extra);
  }
});

// --- rules Bilikha added after auditing a pull request that passed every gate --

test('tooling changed alongside the product fails, unless an exception gives a reason', () => {
  const mixed = files(
    '.claude/settings.json',
    '.mcp.json',
    'backend/src/modules/tools/application/pin-tool.ts',
    'backend/src/modules/tools/application/pin-tool.test.ts',
  );
  assert.ok(has(auditPullRequest({ body: COMPLETE, files: mixed }), "the repository's own tooling"));
  assert.deepEqual(
    auditPullRequest({ body: `${COMPLETE}\nTooling change: the hook must ship with the API it guards\n`, files: mixed }),
    [],
  );
});

test('a tooling-only pull request passes', () => {
  assert.deepEqual(
    auditPullRequest({ body: COMPLETE, files: files('.github/workflows/ci.yml', 'scripts/check-pr.mjs', 'scripts/check-pr.test.mjs') }),
    [],
  );
});

test('CLAUDE.md, the git hooks and the root package.json count as tooling', () => {
  for (const path of ['CLAUDE.md', '.githooks/pre-push', 'package.json']) {
    const problems = auditPullRequest({ body: COMPLETE, files: files(path, 'backend/src/x.ts', 'backend/src/x.test.ts') });
    assert.ok(has(problems, "the repository's own tooling"), path);
  }
});

test('a ticked box whose note says it was not done fails', () => {
  for (const note of ['dark theme not yet checked in a browser', 'phone width not opened in a browser', 'still needs a pass', 'TODO']) {
    const body = COMPLETE.replace('- [x] Checks pass locally', `- [x] Checks pass locally — ${note}`);
    assert.ok(has(auditPullRequest({ body, files: [] }), 'ticks a box its own note says was not done'), note);
  }
});

test('ordinary notes on ticked boxes pass', () => {
  for (const note of ['checked in review', 'n/a — nothing to migrate', 'nothing the running code still reads is dropped']) {
    const body = COMPLETE.replace('- [x] Checks pass locally', `- [x] Checks pass locally — ${note}`);
    assert.deepEqual(auditPullRequest({ body, files: [] }), [], note);
  }
});

const lock = (packages) => JSON.stringify({ lockfileVersion: 3, packages });
const LOCK_BEFORE = lock({
  '': { dependencies: { a: '1' } },
  'node_modules/@rollup/rollup-linux-x64-musl': { version: '4.0.0', os: ['linux'], cpu: ['x64'], libc: ['musl'] },
  'node_modules/removed-pkg': { version: '1.0.0', libc: ['glibc'] },
});

test('a lockfile that loses platform fields from installed packages fails', () => {
  const after = lock({
    '': { dependencies: { a: '1' } },
    'node_modules/@rollup/rollup-linux-x64-musl': { version: '4.0.0', os: ['linux'], cpu: ['x64'] },
  });
  const problems = auditPullRequest({
    body: COMPLETE,
    files: files('frontend/package-lock.json', 'frontend/package.json'),
    contents: { 'frontend/package-lock.json': { before: LOCK_BEFORE, after } },
  });
  assert.ok(has(problems, 'drops platform fields from 1 package(s)'));
  assert.ok(has(problems, 'rollup-linux-x64-musl (libc)'));
});

test('removing a package entirely, or keeping its fields, passes', () => {
  const after = lock({
    '': { dependencies: { a: '1' } },
    'node_modules/@rollup/rollup-linux-x64-musl': { version: '4.0.0', os: ['linux'], cpu: ['x64'], libc: ['musl'] },
  });
  assert.deepEqual(
    auditPullRequest({
      body: COMPLETE,
      files: files('frontend/package-lock.json', 'frontend/package.json'),
      contents: { 'frontend/package-lock.json': { before: LOCK_BEFORE, after } },
    }),
    [],
  );
});
