import * as m from 'motion/react-m';
import type { ComponentType } from 'react';
import {
  AccountsIcon,
  AlertIcon,
  AtlasIcon,
  CheckIcon,
  ExternalLinkIcon,
  InProductionIcon,
  MonitorIcon,
  MoonIcon,
  NoManufacturersIcon,
  PlusIcon,
  QuotedIcon,
  RefreshIcon,
  SamplingIcon,
  SidebarIcon,
  SpecsReceivedIcon,
  SunIcon,
  ThemeIcon,
  ToolsIcon,
  WifiOffIcon,
  type IconProps,
} from '@/shared/ui/icons';
import { iconTrigger } from '@/shared/ui/motion';
import { ShowcaseSection } from '../ShowcaseSection';

const ICONS: { name: string; Icon: ComponentType<IconProps>; motion: string }[] = [
  { name: 'Accounts', Icon: AccountsIcon, motion: 'Second person joins' },
  { name: 'Atlas', Icon: AtlasIcon, motion: 'Folds redraw in turn' },
  { name: 'Tools', Icon: ToolsIcon, motion: 'Tiles dip in turn' },
  { name: 'Theme', Icon: ThemeIcon, motion: 'Paint dots pop' },
  { name: 'Sun', Icon: SunIcon, motion: 'Rays redraw around' },
  { name: 'Moon', Icon: MoonIcon, motion: 'Rocks; star blinks' },
  { name: 'Monitor', Icon: MonitorIcon, motion: 'Screen redraws' },
  { name: 'External link', Icon: ExternalLinkIcon, motion: 'Arrow leaves, returns' },
  { name: 'Plus', Icon: PlusIcon, motion: 'Strokes redraw' },
  { name: 'Sidebar', Icon: SidebarIcon, motion: 'Chevron nudges' },
  { name: 'Check', Icon: CheckIcon, motion: 'Tick draws on' },
  { name: 'Alert', Icon: AlertIcon, motion: 'Ring shakes' },
  { name: 'Refresh', Icon: RefreshIcon, motion: 'Halves turn' },
  { name: 'Offline', Icon: WifiOffIcon, motion: 'Signal fades out' },
  { name: 'Specifications received', Icon: SpecsReceivedIcon, motion: 'Lines write in turn' },
  { name: 'Quoted', Icon: QuotedIcon, motion: 'Price sign redraws' },
  { name: 'Sampling', Icon: SamplingIcon, motion: 'Liquid sloshes' },
  { name: 'In production', Icon: InProductionIcon, motion: 'Windows light in turn' },
  { name: 'No manufacturers', Icon: NoManufacturersIcon, motion: 'Slash draws on' },
];

export function IconsSection() {
  return (
    <ShowcaseSection
      index={6}
      title="Icons"
      description="Each stroke moves on its own, played by whatever the icon sits in. Hover or tab to a tile."
    >
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
        {ICONS.map(({ name, Icon, motion }) => (
          <li key={name}>
            <m.div
              {...iconTrigger}
              tabIndex={0}
              className="flex flex-col items-start gap-4 rounded-surface border border-border bg-surface p-4 transition-colors duration-150 ease-standard hover:border-border-strong"
            >
              <span className="inline-flex size-10 items-center justify-center rounded-control bg-accent-soft text-accent-ink">
                <Icon size={20} />
              </span>
              <div className="flex flex-col">
                <p className="text-sm font-medium text-ink">{name}</p>
                <p className="text-xs text-ink-muted">{motion}</p>
              </div>
            </m.div>
          </li>
        ))}
      </ul>
    </ShowcaseSection>
  );
}
