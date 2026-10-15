#!/usr/bin/env node
/**
 * Rejects AI attribution in commit messages.
 *
 * CLAUDE.md forbids `Co-authored-by` trailers naming an AI tool. A rule in a
 * markdown file only binds the tools that read it; this binds the ones that
 * do not. In Bilikha, 37 commits carried an AI trailer despite the rule, and
 * GitHub attached a bot to the contributor list for good. See ADR 0009.
 *
 * Two modes:
 *
 *   node scripts/check-commit-msg.mjs .git/COMMIT_EDITMSG    # one message file
 *   node scripts/check-commit-msg.mjs --range main..HEAD     # every commit in a range
 *
 * Exits 1 if any message carries attribution.
 */
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { findAttribution } from './ai-attribution.mjs';

/**
 * Git strips comment lines itself, but only after this hook has run, so the
 * message still contains the whole commit template at the point we see it.
 * Everything below the scissors line is diff, not message.
 */
function stripComments(message) {
  const scissors = message.indexOf('\n# ------------------------ >8');
  const body = scissors === -1 ? message : message.slice(0, scissors);
  return body
    .split('\n')
    .filter((line) => !line.startsWith('#'))
    .join('\n');
}

/** Returns a list of `{ line, text, why }` for everything wrong with a message. */
function inspect(message) {
  return findAttribution(stripComments(message));
}

/** Reads `git log` for a range into `{ sha, subject, message }` records. */
function commitsInRange(range) {
  const out = execFileSync('git', ['log', '--format=%H%x1f%B%x1e', ...range.split(/\s+/).filter(Boolean)], {
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
  });

  return out
    .split('\x1e')
    .map((record) => record.replace(/^\n/, ''))
    .filter((record) => record.trim() !== '')
    .map((record) => {
      const [sha, message] = record.split('\x1f');
      return { sha, message, subject: message.split('\n')[0] };
    });
}

function report(label, problems) {
  console.error(`\n  ${label}`);
  for (const { line, text, why } of problems) {
    console.error(`    line ${line}: ${text}`);
    console.error(`             ^ ${why}`);
  }
}

const args = process.argv.slice(2);
let failed = 0;
let checked = 0;

if (args[0] === '--range') {
  const range = args[1];

  if (!range) {
    console.error('usage: node scripts/check-commit-msg.mjs --range <rev-range>');
    process.exit(2);
  }

  for (const { sha, subject, message } of commitsInRange(range)) {
    checked += 1;
    const problems = inspect(message);
    if (problems.length > 0) {
      if (failed === 0) console.error('AI attribution found in commit messages:');
      report(`${sha.slice(0, 7)}  ${subject}`, problems);
      failed += 1;
    }
  }
} else {
  const file = args[0];

  if (!file) {
    console.error('usage: node scripts/check-commit-msg.mjs <message-file> | --range <rev-range>');
    process.exit(2);
  }

  checked = 1;
  const problems = inspect(readFileSync(file, 'utf8'));

  if (problems.length > 0) {
    console.error('AI attribution found in the commit message:');
    report('the message you just wrote', problems);
    failed = 1;
  }
}

if (failed > 0) {
  console.error(`
Commits in this repository are authored by the human contributor alone. The
commit history is a professional record of the organisation's work, and the
tooling used to produce it does not belong in authorship metadata — CLAUDE.md,
"Commit and pull request attribution", and ADR 0009.

Remove the line(s) above and commit again:

    git commit --amend            # the commit you just made
    git rebase -i <base>          # anything older

Do not reach for --no-verify. CI runs this same check on every push, and a
trailer that reaches GitHub even once attaches that account to the contributor
list for good.
`);
  process.exit(1);
}

console.log(`Checked ${checked} commit message(s). No AI attribution.`);
