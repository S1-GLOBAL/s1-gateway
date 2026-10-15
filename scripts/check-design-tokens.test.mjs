import assert from 'node:assert/strict';
import { test } from 'node:test';
import { inspectSource } from './check-design-tokens.mjs';

const has = (problems, fragment) => problems.some((problem) => problem.why.includes(fragment));

test('clean token-only source passes', () => {
  assert.deepEqual(
    inspectSource(`export function Card() {
  return <div className="rounded-surface bg-surface text-ink shadow-sm">ok</div>;
}
`),
    [],
  );
});

test('text-accent fails; text-accent-ink does not', () => {
  assert.ok(has(inspectSource(`<p className="text-accent">x</p>`), 'text-accent'));
  assert.deepEqual(inspectSource(`<p className="text-accent-ink">x</p>`), []);
  assert.deepEqual(inspectSource(`<p className="bg-accent text-on-accent">x</p>`), []);
});

test('hand-added tracking fails', () => {
  assert.ok(has(inspectSource(`<h1 className="text-xl tracking-tight">x</h1>`), 'tracking-*'));
});

test('arbitrary token values fail; layout brackets do not', () => {
  assert.ok(has(inspectSource(`<p className="text-[13px]">x</p>`), 'arbitrary token'));
  assert.ok(has(inspectSource(`<div className="shadow-[0_1px_2px]">x</div>`), 'arbitrary token'));
  assert.ok(has(inspectSource(`<div className="bg-[#c8f135]">x</div>`), 'arbitrary token'));
  assert.ok(has(inspectSource(`<div className="rounded-[12px]">x</div>`), 'arbitrary token'));
  assert.ok(has(inspectSource(`<div className="duration-[250ms]">x</div>`), 'arbitrary token'));
  assert.ok(has(inspectSource(`<div className="ease-[cubic-bezier(0.4,0,0.2,1)]">x</div>`), 'arbitrary token'));
  assert.deepEqual(inspectSource(`<div className="grid grid-cols-[2fr_1fr] w-[28rem] pb-[env(safe-area-inset-bottom)]">x</div>`), []);
  assert.deepEqual(inspectSource(`<div className="transition-[color,opacity] duration-150">x</div>`), []);
});

test('raw colours fail', () => {
  assert.ok(has(inspectSource(`const color = '#c8f135';`), 'raw hex'));
  assert.ok(has(inspectSource(`style={{ color: 'rgb(17 19 16)' }}`), 'raw rgb'));
});

test('interpolated class names fail; other interpolations do not', () => {
  assert.ok(has(inspectSource('const el = <div className={`bg-${tone}`}>x</div>;'), 'interpolated'));
  assert.ok(has(inspectSource('const c = cn(`text-${size}`);'), 'interpolated'));
  assert.deepEqual(inspectSource('const id = `theme-${title}`;'), []);
  assert.deepEqual(
    inspectSource('style={{ background: `var(--color-${token})` }}'),
    [],
  );
});

test('comments are ignored', () => {
  assert.deepEqual(inspectSource('// never use text-accent or #fff or text-[13px]\nconst ok = 1;\n'), []);
});
