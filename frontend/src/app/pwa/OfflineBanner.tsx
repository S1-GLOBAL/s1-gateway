import { useOnlineStatus } from './use-online-status';

/** Offline is a state, not an error: say what is happening, in a sentence. */
export function OfflineBanner() {
  const online = useOnlineStatus();
  if (online) return null;

  return (
    <p role="status" className="border-b border-border bg-surface-raised px-4 py-2 text-center text-sm text-ink-muted">
      You are offline. The Gateway will show live data again when you reconnect.
    </p>
  );
}
