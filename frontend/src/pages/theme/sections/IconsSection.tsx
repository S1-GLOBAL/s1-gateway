import * as m from 'motion/react-m';
import type { ComponentType } from 'react';
import {
  AccountsIcon,
  AlertIcon,
  CheckIcon,
  ExternalLinkIcon,
  MonitorIcon,
  MoonIcon,
  PlusIcon,
  RefreshIcon,
  SidebarIcon,
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
