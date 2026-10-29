import { expectedFill } from './applicability.js';
import { capacityAmount, codeMessages, measurement, slotOfLetter, type CodedSlotKey } from './code.js';
import type { Dictionary } from './dictionary.js';
import { CAPACITY_UNIT_LABELS, NOT_KNOWN, RULED_SLOTS, slotDefinition, type DictionarySlotKey, type RuledSlotKey } from './slots.js';
import { SpecId, meaningOfFact } from './spec-id.js';

/** What a code says so far, while it is typed (ADR 0032). */
export interface CodeWatch {
  /** About the parts that cannot be read yet, in the order they are typed. */
  readonly warnings: readonly string[];
  /** Each fact read so far, in plain words. */
  readonly facts: readonly { readonly name: string; readonly meaning: string }[];
}

/** One letter and what follows it, as far as it is typed. */
interface Piece {
  readonly slot: CodedSlotKey | undefined;
  /** The letter and its digits, or a run of digits with no letter. */
  readonly raw: string;
  readonly digits: string;
  /** Nothing is typed after it yet. */
  readonly trailing: boolean;
  /** The last piece, with nothing typed after its letter yet. */
  readonly open: boolean;
}

/**
 * Reads a code as it is typed, leaving the text alone. A whole code that reads
 * gives its facts. Otherwise each part is read on its own: a letter that is
 * not the code's, or a number the dictionary does not have, says
 * `This key/part is unknown.`; a letter with no number, that the fact has no
 * value; the same slot twice, that it is given twice; a slot the product
 * doesn't have, that the part is not applicable. A number still being typed
 * is not warned about.
 */
export function watchCode(input: string, dictionary: Dictionary): CodeWatch {
  const trimmed = input.trim();
  if (trimmed.length === 0) return { warnings: [], facts: [] };
  const strict = SpecId.parse(trimmed, dictionary);
  if (strict.ok) {
    const facts = strict.value.describe(dictionary).filter((slot) => slot.state === 'value');
    return { warnings: [], facts: facts.map(({ name, meaning }) => ({ name, meaning })) };
  }

  let text = trimmed.toUpperCase();
  const warnings: string[] = [];
  if (!/^[A-Z0-9-]*$/.test(text.replace(/(\d)\.(\d)/g, '$1$2'))) {
    warnings.push(codeMessages.characters());
    text = text.replace(/[^A-Z0-9-]/g, '');
  }
  if (text.split('-').length > 2) warnings.push(codeMessages.hyphens());

  const pieces = cut(text.replaceAll('-', ''));
  const optionOf = (slot: DictionarySlotKey): string | undefined => {
    const piece = pieces.find((candidate) => candidate.slot === slot && candidate.digits.length > 0);
    return piece === undefined ? undefined : dictionary.valueNumbered(slot, Number(piece.digits))?.code;
  };
  const product = optionOf('productType');
  const shape = optionOf('shape') ?? NOT_KNOWN;
  const material = optionOf('material') ?? NOT_KNOWN;
  const productName = product === undefined ? undefined : dictionary.meaningOf('productType', product)?.toLowerCase();

  const seen = new Set<CodedSlotKey>();
  const facts: { name: string; meaning: string }[] = [];
  for (const piece of pieces) {
    if (piece.slot === undefined) {
      warnings.push(`${piece.raw}: This key/part is unknown.`);
      continue;
    }
    const { name } = slotDefinition(piece.slot);
    if (seen.has(piece.slot)) {
      warnings.push(codeMessages.twice(piece.slot));
      continue;
    }
    seen.add(piece.slot);

    const meaning = meaningOfPiece(piece, dictionary);
    const ruled = (RULED_SLOTS as readonly string[]).includes(piece.slot);
    const expected =
      product !== undefined && ruled ? expectedFill(dictionary, product, piece.slot as RuledSlotKey, shape, material) : null;
    if (piece.digits.length === 0) {
      if (!piece.open && expected?.fill !== 'does-not-apply') warnings.push(`${name} (${piece.raw}) has no value.`);
    } else if (meaning === undefined && !stillComing(piece)) {
      warnings.push(`${piece.raw}: This key/part is unknown.`);
    }
    if (expected?.fill === 'does-not-apply' && productName !== undefined) {
      warnings.push(`${name}: This part is not applicable for a ${productName}.`);
      continue;
    }
    if (meaning !== undefined) facts.push({ name, meaning });
  }
  return { warnings, facts };
}

/** Letters, each with the digits after it; a capacity's may hold one point. Digits with no letter are a piece of their own. */
function cut(text: string): Piece[] {
  const pieces: Piece[] = [];
  let index = 0;
  while (index < text.length) {
    if (isDigit(text.charAt(index))) {
      let end = index;
      while (isDigit(text.charAt(end))) end += 1;
      pieces.push({ slot: undefined, raw: text.slice(index, end), digits: '', trailing: end === text.length, open: false });
      index = end;
      continue;
    }
    const letter = text.charAt(index);
    let end = index + 1;
    while (isDigit(text.charAt(end))) end += 1;
    if (letter === 'G' && text.charAt(end) === '.' && isDigit(text.charAt(end + 1))) {
      end += 1;
      while (isDigit(text.charAt(end))) end += 1;
    }
    const digits = text.slice(index + 1, end);
    const trailing = end === text.length;
    pieces.push({ slot: slotOfLetter(letter), raw: text.slice(index, end), digits, trailing, open: trailing && digits.length === 0 });
    index = end;
  }
  return pieces;
}

function meaningOfPiece(piece: Piece, dictionary: Dictionary): string | undefined {
  const { slot, digits } = piece;
  if (slot === undefined || digits.length === 0) return undefined;
  const { kind } = slotDefinition(slot);
  if (kind === 'capacity') {
    const unit = dictionary.valueNumbered('capacity', Number(digits.slice(0, 1)))?.code;
    const amount = capacityAmount(digits.slice(1));
    const label = unit === undefined ? undefined : CAPACITY_UNIT_LABELS[unit];
    return label === undefined || amount === undefined ? undefined : `${amount} ${label}`;
  }
  if (!/^\d+$/.test(digits) || Number(digits) < 1) return undefined;
  const number = Number(digits);
  if (kind === 'dictionary') {
    const code = dictionary.valueNumbered(slot as DictionarySlotKey, number)?.code;
    return code === undefined ? undefined : meaningOfFact(slot, code, dictionary);
  }
  if (kind === 'measure') return meaningOfFact(slot, measurement(slot as Parameters<typeof measurement>[0], number), dictionary);
  if (kind === 'count') return meaningOfFact(slot, String(number), dictionary);
  return undefined;
}

/** A number still being typed: the last piece's zeros, or a capacity's unit digit and zeros. */
function stillComing(piece: Piece): boolean {
  if (!piece.trailing) return false;
  if (piece.slot === 'capacity') return /^\d0*$/.test(piece.digits);
  return /^0+$/.test(piece.digits);
}

function isDigit(character: string): boolean {
  return character >= '0' && character <= '9';
}
