/**
 * Which screen a path belongs to for the door curtain (ADR 0028).
 * Hub pages share one key so the shell stays mounted and keeps its own fade.
 */

export interface DoorStage {
  /** Stable across every page inside the hub. */
  key: string;
  /** Words on the curtain. Null when this screen swaps with no curtain. */
  label: string | null;
}

/** Passed on the history entry when sign-in is what opened the hub. */
export const WELCOME_INTO_HUB = { welcome: true } as const;

/** Signed-out pages that are not part of the door. */
const PLAIN = new Set(['/sign-up', '/reset-password', '/change-password']);

export function doorStage(pathname: string): DoorStage {
  if (pathname === '/') return { key: 'landing', label: 'Source One' };
  if (pathname === '/sign-in') return { key: 'sign-in', label: 'Sign in' };
  if (pathname === '/register') return { key: 'register', label: 'Source One Internal Registration' };
  if (PLAIN.has(pathname)) return { key: pathname, label: null };
  return { key: 'hub', label: 'welcome back!' };
}

export function wantsWelcome(state: unknown): boolean {
  return typeof state === 'object' && state !== null && (state as { welcome?: unknown }).welcome === true;
}

/**
 * The curtain plays when both sides announce themselves.
 * Entering the hub is the exception: only a sign-in just completed asks for it,
 * so an already-open session slipping from `/` to Atlas stays quiet.
 */
export function doorCrossing(from: DoorStage, to: DoorStage, welcome: boolean): boolean {
  if (from.key === to.key || from.label === null || to.label === null) return false;
  if (to.key === 'hub') return welcome;
  return true;
}

export interface DoorCurtain {
  label: string;
  playId: number;
}

/** Where the curtain is, and which navigation generation it belongs to. */
export interface DoorTrack {
  path: string;
  generation: number;
  curtain: DoorCurtain | null;
}

/**
 * The first paint. The landing, sign-in and an invite link start covered.
 * A hub address does not: "welcome back!" is only for a sign-in just completed.
 */
export function bootTrack(pathname: string): DoorTrack {
  const stage = doorStage(pathname);
  const curtain =
    stage.label !== null && stage.key !== 'hub' ? { label: stage.label, playId: 0 } : null;
  return { path: pathname, generation: 0, curtain };
}

/**
 * Advance the track when the path changes. A real crossing replaces the curtain.
 * Anything else leaves the current one alone, so a landing that is still
 * rising away can finish after it redirects into the hub.
 */
export function nextDoorTrack(track: DoorTrack, pathname: string, state: unknown): DoorTrack {
  if (track.path === pathname) return track;
  const from = doorStage(track.path);
  const to = doorStage(pathname);
  const open = doorCrossing(from, to, wantsWelcome(state)) && to.label !== null;
  return {
    path: pathname,
    generation: track.generation + 1,
    curtain: open && to.label ? { label: to.label, playId: (track.curtain?.playId ?? 0) + 1 } : track.curtain,
  };
}
