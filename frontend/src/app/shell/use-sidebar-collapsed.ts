import { useCallback, useState } from 'react';

export const SIDEBAR_STORAGE_KEY = 's1-gateway.sidebar';

function readCollapsed(): boolean {
  try {
    return window.localStorage.getItem(SIDEBAR_STORAGE_KEY) === 'collapsed';
  } catch {
    return false;
  }
}

/** Whether the sidebar is folded to its icon rail. Remembered per device. */
export function useSidebarCollapsed(): [boolean, () => void] {
  const [collapsed, setCollapsed] = useState(readCollapsed);

  const toggle = useCallback(() => {
    setCollapsed((current) => {
      const next = !current;
      try {
        window.localStorage.setItem(SIDEBAR_STORAGE_KEY, next ? 'collapsed' : 'expanded');
      } catch {
        // Not remembered; it still folds for this visit.
      }
      return next;
    });
  }, []);

  return [collapsed, toggle];
}
