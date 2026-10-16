const KEY = 's1_gateway.had_session';

/** Remembers that this browser successfully loaded `/auth/me` once this tab session. */
export function markSessionKnown(): void {
  try {
    sessionStorage.setItem(KEY, '1');
  } catch {
    // Private mode or blocked storage — the session-ended notice is best-effort.
  }
}

/** True when we previously knew a session; clears the flag so the notice shows once. */
export function takePriorSessionEnded(): boolean {
  try {
    if (sessionStorage.getItem(KEY) !== '1') return false;
    sessionStorage.removeItem(KEY);
    return true;
  } catch {
    return false;
  }
}

export function clearSessionKnown(): void {
  try {
    sessionStorage.removeItem(KEY);
  } catch {
    // ignore
  }
}
