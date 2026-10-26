import type { SavedSpecId } from './saved-spec-id.js';

export type SpecIdChangeKind = 'created' | 'updated';

export interface SpecIdChangeProps {
  readonly id: string;
  /** The saved Spec ID's id. */
  readonly specId: string;
  readonly kind: SpecIdChangeKind;
  /** The account that made the change. */
  readonly changedBy: string;
  readonly changedAt: Date;
  /** Null for `created`. */
  readonly codeBefore: string | null;
  readonly codeAfter: string;
  /** Null for `created`. */
  readonly nameBefore: string | null;
  readonly nameAfter: string;
  /** The dictionary change whose approval made it (ADR 0031); null, or left out, for anyone's own edit. */
  readonly dictionaryChangeNumber?: number | null;
}

/** One entry in a saved Spec ID's history (ADR 0022). Only ever added, never changed. */
export class SpecIdChange {
  private constructor(private readonly props: SpecIdChangeProps) {}

  /** The first entry: who saved it, and when. */
  static created(saved: SavedSpecId, id: string): SpecIdChange {
    return new SpecIdChange({
      id,
      specId: saved.id,
      kind: 'created',
      changedBy: saved.savedBy,
      changedAt: saved.savedAt,
      codeBefore: null,
      codeAfter: saved.specId.code,
      nameBefore: null,
      nameAfter: saved.name,
    });
  }

  /**
   * A change from `before` to `after`, made by whoever `after` says last
   * changed it; by approving dictionary change `dictionaryChangeNumber`, when given.
   */
  static updated(before: SavedSpecId, after: SavedSpecId, id: string, dictionaryChangeNumber: number | null = null): SpecIdChange {
    const { updatedBy, updatedAt } = after;
    if (updatedBy === null || updatedAt === null) throw new Error('An updated Spec ID names who changed it and when');
    return new SpecIdChange({
      id,
      specId: after.id,
      kind: 'updated',
      changedBy: updatedBy,
      changedAt: updatedAt,
      codeBefore: before.specId.code,
      codeAfter: after.specId.code,
      nameBefore: before.name,
      nameAfter: after.name,
      dictionaryChangeNumber,
    });
  }

  /** Rebuilds a stored entry. For persistence only. */
  static restore(props: SpecIdChangeProps): SpecIdChange {
    return new SpecIdChange(props);
  }

  /** An update that changes neither the code nor the name: nothing to save or record. */
  get isEmpty(): boolean {
    return this.props.kind === 'updated' && this.props.codeBefore === this.props.codeAfter && this.props.nameBefore === this.props.nameAfter;
  }

  get id(): string {
    return this.props.id;
  }

  get specId(): string {
    return this.props.specId;
  }

  get kind(): SpecIdChangeKind {
    return this.props.kind;
  }

  get changedBy(): string {
    return this.props.changedBy;
  }

  get changedAt(): Date {
    return new Date(this.props.changedAt);
  }

  get codeBefore(): string | null {
    return this.props.codeBefore;
  }

  get codeAfter(): string {
    return this.props.codeAfter;
  }

  get nameBefore(): string | null {
    return this.props.nameBefore;
  }

  get dictionaryChangeNumber(): number | null {
    return this.props.dictionaryChangeNumber ?? null;
  }

  get nameAfter(): string {
    return this.props.nameAfter;
  }
}
