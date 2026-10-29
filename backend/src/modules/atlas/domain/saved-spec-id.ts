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
  /** 1 when saved; raised by 1 on every saved change. Left out, it is 1. */
  readonly version?: number;
  /** Who last changed it, and when; null until the first change. */
  readonly updatedBy?: string | null;
  readonly updatedAt?: Date | null;
}

/** What one change to a saved Spec ID sets. */
export interface SavedSpecIdRevision {
  readonly specId: SpecId;
  readonly name: string;
  /** The release the new code was built with. */
  readonly dictionaryRelease: string;
  /** The changing account's id. */
  readonly by: string;
  readonly at: Date;
}

/** A Spec ID someone named and saved. Its facts and name may change; nothing deletes one (ADR 0022). */
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

  /** The same Spec ID with new facts or a new name: the next version, changed by `by` at `at`. */
  revise(revision: SavedSpecIdRevision): Result<SavedSpecId, InvalidSpecIdError> {
    const issues = checkName(revision.name);
    if (issues.length > 0) return err(new InvalidSpecIdError({ name: issues }));
    return ok(
      new SavedSpecId({
        ...this.props,
        specId: revision.specId,
        name: revision.name.trim(),
        dictionaryRelease: revision.dictionaryRelease,
        version: this.version + 1,
        updatedBy: revision.by,
        updatedAt: revision.at,
      }),
    );
  }

  /**
   * The same Spec ID, its code unchanged, its slots as an approved dictionary
   * change leaves them: an option in its new letters, or a marker its rules
   * change (ADR 0032). Nothing a person reads changes, so it is no new version
   * and adds nothing to History.
   */
  relettered(specId: SpecId): SavedSpecId {
    return new SavedSpecId({ ...this.props, specId });
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

  get version(): number {
    return this.props.version ?? 1;
  }

  get updatedBy(): string | null {
    return this.props.updatedBy ?? null;
  }

  get updatedAt(): Date | null {
    return this.props.updatedAt ? new Date(this.props.updatedAt) : null;
  }

  /** When it was saved or last changed: the library lists by this, newest first. */
  get lastChangedAt(): Date {
    return this.updatedAt ?? this.savedAt;
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
