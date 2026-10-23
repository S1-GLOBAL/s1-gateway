import { useReducedMotion } from 'motion/react';
import * as m from 'motion/react-m';
import type { ComponentType } from 'react';
import {
  InProductionIcon,
  NoManufacturersIcon,
  QuotedIcon,
  SamplingIcon,
  SpecsReceivedIcon,
  type IconProps,
} from '@/shared/ui/icons';
import type { ManufacturerStageCounts } from '../../domain/atlas';
import { stageIcons, type StageIconKey } from '../../domain/stage-icons';

const ICONS: Record<StageIconKey, ComponentType<IconProps>> = {
  'specifications-received': SpecsReceivedIcon,
  quoted: QuotedIcon,
  sampling: SamplingIcon,
  'in-production': InProductionIcon,
  none: NoManufacturersIcon,
};

/**
 * A card's five stage icons (#73). Lit icons draw themselves once when the
 * row mounts; the card replays them by mounting it again (a new `key`) when
 * hovered. Nothing loops (ADR 0012). Unlit icons never move, and with reduced
 * motion nothing does.
 */
export function StageIcons({ counts }: { counts: ManufacturerStageCounts }) {
  const reduced = useReducedMotion() === true;
  return (
    <m.ul
      aria-label="Manufacturer stages"
      data-motion={reduced ? 'off' : 'on'}
      initial="rest"
      animate={reduced ? 'rest' : 'active'}
      className="flex items-center gap-2"
    >
      {stageIcons(counts).map(({ key, lit, label }) => {
        const Icon = ICONS[key];
        return (
          <li
            key={key}
            title={label}
            aria-label={label}
            data-lit={lit}
            className={lit ? 'inline-flex text-accent-ink' : 'inline-flex text-ink-subtle opacity-40'}
          >
            {lit ? (
              <Icon size={16} />
            ) : (
              // Its own state, always at rest: the row's animation never reaches it.
              <m.span initial="rest" animate="rest" className="inline-flex">
                <Icon size={16} />
              </m.span>
            )}
          </li>
        );
      })}
    </m.ul>
  );
}
