import {
  createContext,
  useCallback,
  useContext,
  useLayoutEffect,
  useMemo,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from 'react';
import { resolveTheme, type ResolvedTheme, type ThemePreference } from '../domain/theme';
import type { ThemeDocument, ThemePreferenceStore } from './theme-ports';

interface ThemeContextValue {
  preference: ThemePreference;
  resolved: ResolvedTheme;
  setPreference(preference: ThemePreference): void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({
  store,
  document,
  children,
}: {
  store: ThemePreferenceStore;
  document: ThemeDocument;
  children: ReactNode;
}) {
  const [preference, setPreferenceState] = useState<ThemePreference>(() => store.read());
  const systemPrefersDark = useSyncExternalStore(
    (listener) => document.subscribe(listener),
    () => document.prefersDark(),
    () => false,
  );
  const resolved = resolveTheme(preference, systemPrefersDark);

  // Before paint, so a change never shows a frame in the old theme.
  useLayoutEffect(() => {
    document.apply(resolved);
  }, [document, resolved]);

  const setPreference = useCallback(
    (next: ThemePreference) => {
      store.write(next);
      document.transition(() => setPreferenceState(next));
    },
    [document, store],
  );

  const value = useMemo(() => ({ preference, resolved, setPreference }), [preference, resolved, setPreference]);
  return <ThemeContext value={value}>{children}</ThemeContext>;
}

export function useTheme(): ThemeContextValue {
  const value = useContext(ThemeContext);
  if (!value) throw new Error('useTheme must be used inside <ThemeProvider>.');
  return value;
}
