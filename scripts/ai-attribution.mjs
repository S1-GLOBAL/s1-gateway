/**
 * What counts as AI attribution, shared by the commit-message check
 * (check-commit-msg.mjs) and the pull request description check
 * (check-pr.mjs). See ADR 0009.
 */

/**
 * Matched against the display name of a `Co-authored-by` trailer. Deliberately
 * a list of product names rather than anything clever: a human contributor is
 * not called Copilot, and a check that tries to infer "is this an AI" from
 * shape rather than from a name would reject real people.
 */
const AI_NAME = /\b(cursor|claude|anthropic|copilot|codex|chatgpt|openai|gemini|devin|aider|windsurf|cody|tabnine)\b/i;

/**
 * Matched against the email. `[bot]` and a bare `bot@` cover the accounts
 * GitHub itself marks as bots. `users.noreply.github.com` is NOT listed — that
 * is the address real contributors use when they hide their email.
 */
const AI_EMAIL = /(cursoragent|@cursor\.com|@anthropic\.com|@openai\.com|\[bot\]|\bbot@|@[\w.-]+\.ai\b)/i;

/** Footers that claim AI authorship without using a trailer. */
const AI_FOOTERS = [
  { pattern: /🤖/u, why: 'robot-emoji generation footer' },
  {
    pattern: /\bgenerated (with|by)\b[^\n]*\b(claude|cursor|copilot|chatgpt|codex|gemini|ai)\b/i,
    why: '"Generated with <AI tool>" footer',
  },
  {
    pattern: /\b(assisted|written|authored) by\b[^\n]*\b(claude|cursor|copilot|chatgpt|codex|gemini|an? ai)\b/i,
    why: '"Assisted by <AI tool>" line',
  },
];

const TRAILER = /^\s*co-authored-by:\s*(.+?)\s*$/i;

/** Returns a list of `{ line, text, why }` for every line of `text` that credits an AI tool. */
export function findAttribution(text) {
  const problems = [];
  const lines = text.replace(/\r\n/g, '\n').split('\n');

  lines.forEach((line, index) => {
    const trailer = line.match(TRAILER);

    if (trailer) {
      const identity = trailer[1];
      if (AI_NAME.test(identity) || AI_EMAIL.test(identity)) {
        problems.push({ line: index + 1, text: line.trim(), why: 'Co-authored-by naming an AI tool' });
      }
      return;
    }

    for (const { pattern, why } of AI_FOOTERS) {
      if (pattern.test(line)) {
        problems.push({ line: index + 1, text: line.trim(), why });
        return;
      }
    }
  });

  return problems;
}
