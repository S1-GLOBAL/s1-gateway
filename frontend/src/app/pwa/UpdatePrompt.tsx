import { AnimatePresence } from 'motion/react';
import * as m from 'motion/react-m';
import { useRegisterSW } from 'virtual:pwa-register/react';
import { Button } from '@/shared/ui/Button';
import { RefreshIcon } from '@/shared/ui/icons';
import { duration, ease } from '@/shared/ui/motion';

/** A new version waits until the user chooses to reload (ADR 0010). */
export function UpdatePrompt() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW();

  return (
    <AnimatePresence>
      {needRefresh && (
        <m.div
          role="status"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0, transition: { duration: duration.slow, ease: ease.emphasized } }}
          exit={{ opacity: 0, y: 12, transition: { duration: duration.fast, ease: ease.exit } }}
          className="fixed inset-x-4 bottom-20 z-30 mx-auto flex max-w-md items-center gap-3 rounded-surface border border-border bg-surface p-3 pl-4 shadow-lg md:bottom-6"
        >
          <p className="flex-1 text-sm text-ink">A new version of the Gateway is ready.</p>
          <Button variant="ghost" size="sm" onClick={() => setNeedRefresh(false)}>
            Later
          </Button>
          <Button size="sm" onClick={() => void updateServiceWorker(true)}>
            <RefreshIcon size={14} />
            Reload
          </Button>
        </m.div>
      )}
    </AnimatePresence>
  );
}
