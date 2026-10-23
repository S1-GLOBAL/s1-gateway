import type { ManufacturerStageCounts } from './atlas';

export type StageIconKey = 'specifications-received' | 'quoted' | 'sampling' | 'in-production' | 'none';

export interface StageIcon {
  key: StageIconKey;
  /** Some manufacturer has reached this stage; for `none`, the Spec ID has no manufacturers. */
  lit: boolean;
  /** What hovering it, or a screen reader, says (#73). */
  label: string;
}

const manufacturers = (n: number) => `${n} manufacturer${n === 1 ? '' : 's'}`;

/**
 * A card's five icons, in order: the four stages, lit when any manufacturer
 * has reached it, then a fifth, lit when there are none (#73).
 */
export function stageIcons(counts: ManufacturerStageCounts): StageIcon[] {
  const stage = (key: StageIconKey, name: string, n: number): StageIcon => ({
    key,
    lit: n > 0,
    label: n > 0 ? `${name}: ${manufacturers(n)}` : `${name}: none`,
  });
  const total = counts.specificationsReceived;
  return [
    stage('specifications-received', 'Specifications received', counts.specificationsReceived),
    stage('quoted', 'Quoted', counts.quoted),
    stage('sampling', 'Sampling', counts.sampling),
    stage('in-production', 'In production', counts.inProduction),
    { key: 'none', lit: total === 0, label: total === 0 ? 'No manufacturers yet' : `${manufacturers(total)} recorded` },
  ];
}
