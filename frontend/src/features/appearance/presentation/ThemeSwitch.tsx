import { MonitorIcon, MoonIcon, SunIcon } from '@/shared/ui/icons';
import { SegmentedControl, type SegmentedOption } from '@/shared/ui/SegmentedControl';
import { useTheme } from '../application/theme-context';
import type { ThemePreference } from '../domain/theme';

const OPTIONS: readonly SegmentedOption<ThemePreference>[] = [
  { value: 'light', label: 'Light', icon: <SunIcon size={16} /> },
  { value: 'dark', label: 'Dark', icon: <MoonIcon size={16} /> },
  { value: 'system', label: 'Match device', icon: <MonitorIcon size={16} /> },
];

export function ThemeSwitch({ className }: { className?: string }) {
  const { preference, setPreference } = useTheme();
  return (
    <SegmentedControl
      label="Theme"
      iconOnly
      value={preference}
      options={OPTIONS}
      onChange={setPreference}
      className={className}
    />
  );
}
