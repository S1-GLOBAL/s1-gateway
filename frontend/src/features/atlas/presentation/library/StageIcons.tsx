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
 *
 * Each icon's words sit just above it, the same quiet tip as the folded
 * sidebar. The row takes the pointer so that tip can show: on a card, the
 * link covers everything else, and a browser `title` never appears.
 */
export function StageIcons({ counts }: { counts: ManufacturerStageCounts }) {
  const reduced = useReducedMotion() === true;
  return (
    <m.ul
      aria-label="Manufacturer stages"
      data-motion={reduced ? 'off' : 'on'}
      initial="rest"
      animate={reduced ? 'rest' : 'active'}
      className="pointer-events-auto relative z-10 flex items-center gap-2"
    >
      {stageIcons(counts).map(({ key, lit, label }) => {
        const Icon = ICONS[key];
        return (
          <li
            key={key}
            aria-label={label}
            data-lit={lit}
            className={
              lit
                ? 'group/stage relative inline-flex text-accent-ink'
                : 'group/stage relative inline-flex text-ink-subtle'
            }
          >
            <span
              aria-hidden="true"
              className="pointer-events-none absolute bottom-full left-0 z-20 mb-1.5 whitespace-nowrap rounded-control bg-ink px-2 py-1 text-xs font-medium text-canvas opacity-0 shadow-md transition-opacity duration-150 ease-standard group-hover/stage:opacity-100"
            >
              {label}
            </span>
            {lit ? (
              <Icon size={16} />
            ) : (
              // Its own state, always at rest: the row's animation never reaches it.
              // The fade stays on the icon, so the words above it stay solid.
              <m.span initial="rest" animate="rest" className="inline-flex opacity-40">
                <Icon size={16} />
              </m.span>
            )}
          </li>
        );
      })}
    </m.ul>
  );
}
