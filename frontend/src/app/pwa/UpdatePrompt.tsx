import { useRegisterSW } from 'virtual:pwa-register/react';
import { Button } from '@/shared/ui/Button';

/** A new version waits until the user chooses to reload (ADR 0010). */
export function UpdatePrompt() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW();

  if (!needRefresh) return null;

  return (
    <div
      role="status"
      className="fixed inset-x-4 bottom-4 mx-auto flex max-w-md items-center gap-3 rounded-surface border border-border bg-surface-raised p-4"
    >
      <p className="flex-1 text-sm">A new version of the Gateway is ready.</p>
      <Button variant="secondary" onClick={() => setNeedRefresh(false)}>
        Later
      </Button>
      <Button onClick={() => void updateServiceWorker(true)}>Reload</Button>
    </div>
  );
}
