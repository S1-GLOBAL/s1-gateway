import { err, ok, type Result } from '../../../shared/domain/result.js';
import { InvalidSpecIdError } from './spec-id.errors.js';
import type { SpecId } from './spec-id.js';

export const NAME_MAX_LENGTH = 120;

export interface SavedSpecIdProps {
  readonly id: string;
  readonly specId: SpecId;
  readonly name: string;
  readonly dictionaryRelease: string;
  /** The saving account's id. */
  readonly savedBy: string;
  readonly savedAt: Date;
}

/** A Spec ID someone named and saved. Nothing updates or deletes one (ADR 0021). */
export class SavedSpecId {
  private constructor(private readonly props: SavedSpecIdProps) {}

  static create(props: SavedSpecIdProps): Result<SavedSpecId, InvalidSpecIdError> {
    const issues = checkName(props.name);
    if (issues.length > 0) return err(new InvalidSpecIdError({ name: issues }));
    return ok(new SavedSpecId({ ...props, name: props.name.trim() }));
  }

  /** Rebuilds a Spec ID that was valid when it was stored. For persistence only. */
  static restore(props: SavedSpecIdProps): SavedSpecId {
    return new SavedSpecId(props);
  }

  get id(): string {
    return this.props.id;
  }

  get specId(): SpecId {
    return this.props.specId;
  }

  get name(): string {
    return this.props.name;
  }

  get dictionaryRelease(): string {
    return this.props.dictionaryRelease;
  }

  get savedBy(): string {
    return this.props.savedBy;
  }

  get savedAt(): Date {
    return new Date(this.props.savedAt);
  }
}

/**
 * The problems with a name, after trimming it: none, or the one message that
 * applies. Separate from `create` so a save can report name and slot problems together.
 */
export function checkName(name: string): string[] {
  const trimmed = name.trim();
  if (hasControlCharacter(trimmed)) return ['Name must not contain control characters.'];
  if (trimmed.length === 0) return ['Name is required.'];
  if (trimmed.length > NAME_MAX_LENGTH) return [`Name must be at most ${NAME_MAX_LENGTH} characters.`];
  return [];
}

/** A name is one line of text. Postgres also refuses NUL outright, which would otherwise surface as a 500. */
function hasControlCharacter(value: string): boolean {
  // eslint-disable-next-line no-control-regex -- matching control characters is the point
  return /[\u0000-\u001f\u007f]/.test(value);
}
