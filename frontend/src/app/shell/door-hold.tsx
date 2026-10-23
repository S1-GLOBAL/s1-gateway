import { createContext, useContext, useLayoutEffect } from 'react';

export interface DoorHoldApi {
  /** Keep the open curtain covered. Returns the release. */
  hold(): () => void;
  /** This screen is up and is not waiting. An outstanding hold still wins. */
  ready(): void;
}

export const DoorHoldContext = createContext<DoorHoldApi | null>(null);

/**
 * The door curtain stays up while `waiting` is true. Once this screen can be
 * shown it still holds for the minimum still time, then rises away. Pass false
 * for a screen that has nothing to load.
 * Outside the curtain, this does nothing.
 */
export function useDoorHold(waiting: boolean) {
  const api = useContext(DoorHoldContext);
  useLayoutEffect(() => {
    if (!api) return;
    if (waiting) return api.hold();
    api.ready();
  }, [api, waiting]);
}
