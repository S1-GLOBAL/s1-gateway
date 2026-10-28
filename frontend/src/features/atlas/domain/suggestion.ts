import { RULE_LABELS, SLOT_NAMES, type AtlasDictionary, type SlotKey, type SlotRule, type Staff } from './atlas';

/*
 * Suggested changes to the Atlas dictionary (#95, ADR 0031): what one asks
 * for, its trail, and the words people read about it. Where #95's copy table
 * words a line, it is worded exactly so.
 */

export type SuggestionKind = 'add' | 'edit' | 'delete' | 'rules';
export type SuggestionState = 'waiting' | 'approved' | 'rejected' | 'withdrawn';

/** What a suggestion asks for, by kind. */
export type Proposal =
  | { kind: 'add'; meaning: string; searchWords: readonly string[]; rules: Readonly<Partial<Record<SlotKey, SlotRule>>> | null }
  | { kind: 'edit'; newCode: string | null; meaning: string | null; searchWords: readonly string[] | null }
  | { kind: 'delete'; replacement: string | null }
  | { kind: 'rules'; rules: Readonly<Partial<Record<SlotKey, SlotRule>>> };

export interface Suggestion {
  id: string;
  kind: SuggestionKind;
  /** The dictionary list it is about. */
  slot: SlotKey;
  /** The option it is about: the new code for an add, the product type for a rules change. */
  code: string;
  proposal: Proposal;
  state: SuggestionState;
  /** Raised on each edit; an approval names the one the approver read. */
  version: number;
  suggestedBy: Staff;
  suggestedAt: Date;
  /** Who approved or rejected it. */
  decidedBy: Staff | null;
  /** When it was approved, rejected or withdrawn. */
  decidedAt: Date | null;
  /** Why it was rejected. */
  reason: string | null;
  /** The dictionary change it became, once approved. */
  changeNumber: number | null;
}

export interface SuggestionEvent {
  kind: 'suggested' | 'edited' | 'withdrawn' | 'approved' | 'rejected';
  by: Staff;
  at: Date;
  /** An edit's proposal before it. */
  proposalBefore: Proposal | null;
  /** What a suggestion or an edit asks for. */
  proposalAfter: Proposal | null;
  /** A rejection's reason. */
  reason: string | null;
}

/** A saved Spec ID approving would rewrite, with its code now and after. */
export interface Rewrite {
  id: string;
  name: string;
  codeBefore: string;
  codeAfter: string;
}

/** One suggestion with its whole trail and its option's use today. */
export interface SuggestionDetail extends Suggestion {
  /** First step first. */
  events: SuggestionEvent[];
  /** How many saved Spec IDs hold the option now. */
  usage: number;
  /** While it waits: each saved Spec ID approving now would rewrite; null once decided, or when approving would be refused. */
  rewrites: Rewrite[] | null;
  /** While it waits: why approving now would be refused, in the server's words; else null. */
  problem: string | null;
}

/** An approval's answer. */
export interface ApprovedChange {
  suggestion: Suggestion;
  changeNumber: number;
  specIdsRewritten: number;
}

/** `1 saved Spec ID`, `3 saved Spec IDs`. */
export function savedSpecIds(count: number): string {
  return count === 1 ? '1 saved Spec ID' : `${count} saved Spec IDs`;
}

/** Where a suggestion stands, in #95's words. A waiting one reads as its suggester sees it. */
export function stateLine(suggestion: Suggestion): string {
  const decider = suggestion.decidedBy?.fullName ?? 'an admin';
  switch (suggestion.state) {
    case 'waiting':
      return 'Waiting for an admin';
    case 'approved':
      return `Approved as change #${suggestion.changeNumber ?? '?'} by ${decider}`;
    case 'rejected':
      return `Rejected by ${decider}: ${suggestion.reason ?? ''}`;
    case 'withdrawn':
      return 'Withdrawn';
  }
}

/** #95's line once an approval succeeds: "Change #4 is live. 3 saved Spec IDs were updated." */
export function approvedLine(approved: ApprovedChange): string {
  const updated = approved.specIdsRewritten === 1 ? 'was updated' : 'were updated';
  return `Change #${approved.changeNumber} is live. ${savedSpecIds(approved.specIdsRewritten)} ${updated}.`;
}

/** Whether approving can rewrite saved Spec IDs: a new code, a deletion, or a product type's rules. */
export function rewritesSpecIds(proposal: Proposal): boolean {
  return (proposal.kind === 'edit' && proposal.newCode !== null) || proposal.kind === 'delete' || proposal.kind === 'rules';
}

/**
 * How many saved Spec IDs hold the option, in #95's words when approving
 * would change them; null when none does.
 */
export function usageLine(usage: number, proposal: Proposal): string | null {
  if (usage === 0) return null;
  if (!rewritesSpecIds(proposal)) return `Used by ${savedSpecIds(usage)}.`;
  return `Used by ${savedSpecIds(usage)}. If approved, ${usage === 1 ? 'it changes' : 'they change'} too.`;
}

/** Who may do what with a suggestion: the one who made it, or an admin who did not. */
export interface SuggestionActions {
  withdraw: boolean;
  decide: boolean;
}

export function actionsFor(suggestion: Suggestion, viewer: { id: string; isAdmin: boolean }): SuggestionActions {
  const waiting = suggestion.state === 'waiting';
  const own = suggestion.suggestedBy.id === viewer.id;
  return { withdraw: waiting && own, decide: waiting && !own && viewer.isAdmin };
}

/** One line of what a suggestion changes: what it is now, when that is known, and what it asks for. */
export interface ChangeRow {
  label: string;
  /** Today's value, while the suggestion waits; null once decided, or for something new. */
  before: string | null;
  after: string;
}

export interface SuggestionSummary {
  title: string;
  rows: ChangeRow[];
}

const fieldName = (slot: SlotKey) => SLOT_NAMES.find((entry) => entry.key === slot)?.name ?? slot;

/**
 * What a suggestion changes, in words, read against `dictionary`. While it
 * waits, each row also says what the dictionary holds now; once decided the
 * dictionary may already have changed, so only what it asked for is said.
 */
export function describeSuggestion(suggestion: Suggestion, dictionary: AtlasDictionary): SuggestionSummary {
  const { code, proposal } = suggestion;
  const list = dictionary.slots.find((slot) => slot.key === suggestion.slot);
  const listName = list?.name ?? fieldName(suggestion.slot);
  const waiting = suggestion.state === 'waiting';
  const meaningOf = (option: string) => list?.values.find((value) => value.code === option)?.meaning;
  const now = (value: string | undefined): string | null => (waiting && value !== undefined ? value : null);
  const words = (all: readonly string[]) => (all.length === 0 ? 'None' : all.join(', '));

  switch (proposal.kind) {
    case 'add': {
      const rows: ChangeRow[] = [{ label: 'Wording', before: null, after: proposal.meaning }];
      if (proposal.searchWords.length > 0) rows.push({ label: 'Search words', before: null, after: words(proposal.searchWords) });
      if (proposal.rules) {
        const applies = (Object.entries(proposal.rules) as [SlotKey, SlotRule][])
          .filter(([, rule]) => rule !== 'never')
          .map(([slot, rule]) => (rule === 'applies' ? fieldName(slot) : `${fieldName(slot)} (${RULE_LABELS[rule].toLowerCase()})`));
        rows.push({ label: 'Fields that apply', before: null, after: words(applies) });
      }
      return { title: `Add ${code} to ${listName}`, rows };
    }
    case 'edit': {
      const rows: ChangeRow[] = [];
      if (proposal.newCode !== null) rows.push({ label: 'Code', before: code, after: proposal.newCode });
      if (proposal.meaning !== null) rows.push({ label: 'Wording', before: now(meaningOf(code)), after: proposal.meaning });
      if (proposal.searchWords !== null) rows.push({ label: 'Search words', before: null, after: words(proposal.searchWords) });
      return { title: `Change ${code} in ${listName}`, rows };
    }
    case 'delete': {
      const replacing = proposal.replacement;
      const becomes =
        replacing === null
          ? 'Nothing: no saved Spec ID holds it'
          : replacing === 'Y'
            ? 'Not known'
            : meaningOf(replacing) === undefined
              ? replacing
              : `${replacing} (${meaningOf(replacing)})`;
      return {
        title: `Delete ${code} from ${listName}`,
        rows: [
          { label: 'Wording', before: now(meaningOf(code)), after: 'Deleted' },
          { label: 'Saved Spec IDs become', before: null, after: becomes },
        ],
      };
    }
    case 'rules': {
      const ruleNow = (slot: SlotKey) =>
        dictionary.rules.find((entry) => entry.productType === code && entry.slot === slot)?.rule;
      const rows = (Object.entries(proposal.rules) as [SlotKey, SlotRule][]).map(([slot, rule]) => {
        const before = ruleNow(slot);
        return { label: fieldName(slot), before: now(before === undefined ? undefined : RULE_LABELS[before]), after: RULE_LABELS[rule] };
      });
      return { title: `Change which fields apply to ${code}`, rows };
    }
  }
}

const PROPOSAL_FIELDS: readonly { key: string; label: string }[] = [
  { key: 'newCode', label: 'Code' },
  { key: 'meaning', label: 'Wording' },
  { key: 'searchWords', label: 'Search words' },
  { key: 'replacement', label: 'Saved Spec IDs become' },
  { key: 'rules', label: 'Field rules' },
];

function proposalValue(value: unknown): string {
  if (value === null || value === undefined) return 'Unchanged';
  if (Array.isArray(value)) return value.length === 0 ? 'None' : value.join(', ');
  if (typeof value === 'object') {
    const rules = Object.entries(value as Record<string, SlotRule>);
    return rules.length === 0 ? 'None' : rules.map(([slot, rule]) => `${fieldName(slot as SlotKey)}: ${RULE_LABELS[rule]}`).join(', ');
  }
  return String(value);
}

/** What an edit changed in a suggestion's proposal, field by field, for its trail. */
export function editedFields(before: Proposal, after: Proposal): ChangeRow[] {
  const was = before as unknown as Record<string, unknown>;
  const now = after as unknown as Record<string, unknown>;
  return PROPOSAL_FIELDS.filter(({ key }) => key in now && JSON.stringify(was[key]) !== JSON.stringify(now[key])).map(
    ({ key, label }) => ({ label, before: proposalValue(was[key]), after: proposalValue(now[key]) }),
  );
}
