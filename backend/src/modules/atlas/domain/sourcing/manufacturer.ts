/**
 * A company Source One has worked with, as the verified list names it
 * (ADR 0027). Never deleted: #57's stages point at it.
 */
export interface Manufacturer {
  readonly id: string;
  /** As first written. */
  readonly name: string;
  /** Null until a row gives one. */
  readonly country: string | null;
  readonly createdAt: Date;
}

/** A manufacturer's identity: " Acme Packaging " and "acme packaging" are one. */
export function manufacturerKey(name: string): string {
  return name.trim().toLowerCase();
}
