/**
 * Enforces the design-token rules in frontend/DESIGN.md and CLAUDE.md.
 *
 * Tailwind's default palette is already removed in theme.css, so a stray
 * `bg-blue-500` is a no-op. The rules that still need a gate are the ones
 * that look fine and ship wrong: raw colours, one-off type/elevation/radius
 * sizes, interpolated class names, `text-accent`, and hand-added tracking.
 *
 *   node scripts/check-design-tokens.mjs
 *
 * Exits 1 if anything is wrong. `inspectSource` is exported for the tests.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SRC = join(ROOT, 'frontend', 'src');

/** Token definitions live here — the only place raw colours belong. */
const EXEMPT_PATHS = new Set(['styles/theme.css']);

/**
 * Domain and its tests parse hex as data (WCAG contrast). They are not UI.
 * A file that only computes over colour strings is not painting with one.
 */
const EXEMPT_PREFIXES = ['shared/domain/contrast.'];

const EXTENSIONS = new Set(['.ts', '.tsx', '.css']);

/** Lime as text is invisible on light (1.31:1). Use text-accent-ink. */
const TEXT_ACCENT = /(?<![A-Za-z0-9_-])text-accent(?![A-Za-z0-9_-])/;

/** Tracking comes from the type tokens; never add tracking-* by hand. */
const TRACKING = /(?<![A-Za-z0-9_-])tracking-(?:tighter|tight|normal|wide|wider|widest|\[[^\]]+\])/;

/**
 * Arbitrary values that bypass the token tables DESIGN.md names: type scale,
 * elevation, radius, duration/easing, and any utility that embeds a raw colour.
 * Layout brackets (grid-cols-[2fr_1fr], w-[28rem], pb-[env(...)],
 * transition-[color,opacity]) stay — they are composition, not a second palette.
 */
const ARBITRARY_TOKEN = new RegExp(
  [
    String.raw`(?<![A-Za-z0-9_-])text-\[[0-9]`, // text-[13px] — use text-sm / text-base
    String.raw`(?<![A-Za-z0-9_-])shadow-\[`, // shadow-[…] — use shadow-sm / md / lg
    String.raw`(?<![A-Za-z0-9_-])rounded-\[[^\]]+\]`, // rounded-[…] — use control / surface / full
    String.raw`(?<![A-Za-z0-9_-])(?:duration|delay|ease)-\[`, // timed tokens live in theme.css
    String.raw`(?<![A-Za-z0-9_-])[a-z]+-\[[^\]]*(?:#|rgb|hsl)`, // bg-[#fff], from-[rgb(…)]
  ].join('|'),
  'i',
);

/** Raw colours outside theme.css. */
const RAW_HEX = /#(?:[0-9a-fA-F]{3,4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})\b/;
const RAW_RGB_HSL = /\b(?:rgb|rgba|hsl|hsla)\s*\(/i;

/**
 * A template literal passed to className / cn / clsx / twMerge that builds a
 * class from a variable — Tailwind cannot see it, so the style never ships.
 */
const INTERPOLATED_CLASS =
  /(?:className\s*=\s*\{\s*`[^`]*\$\{|className\s*=\s*`[^`]*\$\{|\b(?:cn|clsx|twMerge)\(\s*`[^`]*\$\{)/;

function collect(dir, found = []) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) collect(full, found);
    else if ([...EXTENSIONS].some((ext) => entry.endsWith(ext))) found.push(full);
  }
  return found;
}

/** Blank out comments so documented examples do not fail the check. */
function stripComments(source) {
  let out = '';
  let i = 0;
  while (i < source.length) {
    if (source[i] === '/' && source[i + 1] === '/') {
      out += '//';
      i += 2;
      while (i < source.length && source[i] !== '\n') {
        out += ' ';
        i += 1;
      }
      continue;
    }
    if (source[i] === '/' && source[i + 1] === '*') {
      out += '/*';
      i += 2;
      while (i < source.length && !(source[i] === '*' && source[i + 1] === '/')) {
        out += source[i] === '\n' ? '\n' : ' ';
        i += 1;
      }
      if (i < source.length) {
        out += '*/';
        i += 2;
      }
      continue;
    }
    out += source[i];
    i += 1;
  }
  return out;
}

/** Returns `{ line, text, why }[]` for everything wrong in one file's source. */
export function inspectSource(source) {
  const problems = [];
  const cleaned = stripComments(source);
  const lines = cleaned.split('\n');
  const rawLines = source.replace(/\r\n/g, '\n').split('\n');

  lines.forEach((line, index) => {
    const report = (why) => {
      problems.push({ line: index + 1, text: rawLines[index]?.trim() ?? line.trim(), why });
    };

    if (TEXT_ACCENT.test(line)) report('text-accent — use text-accent-ink (lime is fill-only on light)');
    if (TRACKING.test(line)) report('tracking-* — tracking comes from the type tokens');
    if (ARBITRARY_TOKEN.test(line)) report('arbitrary token value — add a token in theme.css first');
    if (RAW_HEX.test(line)) report('raw hex colour — use a token from theme.css');
    if (RAW_RGB_HSL.test(line)) report('raw rgb/hsl colour — use a token from theme.css');
  });

  let match;
  const re = new RegExp(INTERPOLATED_CLASS.source, 'g');
  while ((match = re.exec(cleaned)) !== null) {
    const line = cleaned.slice(0, match.index).split('\n').length;
    problems.push({
      line,
      text: rawLines[line - 1]?.trim() ?? match[0],
      why: 'interpolated Tailwind class — name every class in full so Tailwind can see it',
    });
  }

  return problems;
}

function isExempt(rel) {
  const normalised = rel.replace(/\\/g, '/');
  if (EXEMPT_PATHS.has(normalised)) return true;
  return EXEMPT_PREFIXES.some((prefix) => normalised.startsWith(prefix));
}

function main() {
  const files = collect(SRC);
  let failed = 0;

  for (const file of files) {
    const rel = relative(SRC, file);
    if (isExempt(rel)) continue;
    const problems = inspectSource(readFileSync(file, 'utf8'));
    if (problems.length === 0) continue;
    if (failed === 0) console.error('Design token rules broken (frontend/DESIGN.md):\n');
    for (const { line, text, why } of problems) {
      console.error(`  frontend/src/${rel.replace(/\\/g, '/')}:${line}`);
      console.error(`    ${text}`);
      console.error(`    ^ ${why}\n`);
    }
    failed += problems.length;
  }

  if (failed > 0) {
    console.error(`${failed} problem(s). Tokens live in frontend/src/styles/theme.css.`);
    process.exit(1);
  }

  console.log(`Checked ${files.length} file(s) under frontend/src. Design tokens only.`);
}

const self = (path) => resolve(path).toLowerCase();
if (process.argv[1] && self(fileURLToPath(import.meta.url)) === self(process.argv[1])) {
  main();
}
