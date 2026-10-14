import * as m from 'motion/react-m';
import { WifiOffIcon } from '@/shared/ui/icons';
import { useOnlineStatus } from './use-online-status';

/** Offline is a state, not an error: say what is happening, in a sentence. */
export function OfflineBanner() {
  const online = useOnlineStatus();
  if (online) return null;

  return (
    <m.p
      role="status"
      initial="rest"
      animate="active"
      className="flex items-center justify-center gap-2 border-b border-border bg-warning-soft px-4 py-2 text-center text-sm text-warning"
    >
      <WifiOffIcon size={16} />
      You are offline. The Gateway will show live data again when you reconnect.
    </m.p>
  );
}
