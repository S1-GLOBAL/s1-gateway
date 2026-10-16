import { render } from '@testing-library/react';
import type { ComponentType } from 'react';
import { describe, expect, it } from 'vitest';
import type { IconProps } from './icon-svg';
import {
  AccountsIcon,
  AlertIcon,
  AtlasIcon,
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
} from './index';

/** Icon, and how many separately drawn strokes it has. */
const ICONS: [string, ComponentType<IconProps>, number][] = [
  ['ToolsIcon', ToolsIcon, 4],
  ['ThemeIcon', ThemeIcon, 5],
  ['AccountsIcon', AccountsIcon, 4],
  ['AtlasIcon', AtlasIcon, 3],
  ['SunIcon', SunIcon, 9],
  ['MoonIcon', MoonIcon, 3],
  ['MonitorIcon', MonitorIcon, 3],
  ['ExternalLinkIcon', ExternalLinkIcon, 3],
  ['PlusIcon', PlusIcon, 2],
  ['SidebarIcon', SidebarIcon, 3],
  ['CheckIcon', CheckIcon, 1],
  ['AlertIcon', AlertIcon, 3],
  ['RefreshIcon', RefreshIcon, 4],
  ['WifiOffIcon', WifiOffIcon, 7],
];

describe.each(ICONS)('%s', (_name, Icon, strokes) => {
  it('is hidden from assistive technology', () => {
    const { container } = render(<Icon />);
    expect(container.querySelector('svg')?.getAttribute('aria-hidden')).toBe('true');
  });

  it('draws each stroke as its own element', () => {
    const { container } = render(<Icon />);
    expect(container.querySelectorAll('path, rect, circle, line')).toHaveLength(strokes);
  });

  it('takes a size', () => {
    const { container } = render(<Icon size={24} />);
    expect(container.querySelector('svg')?.getAttribute('width')).toBe('24');
  });
});
