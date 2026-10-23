import { useReducedMotion } from 'motion/react';
import * as m from 'motion/react-m';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useLocation, useOutlet } from 'react-router-dom';
import { Logo } from '@/shared/ui/Logo';
import { duration, ease } from '@/shared/ui/motion';
import { DoorHoldContext, type DoorHoldApi } from './door-hold';
import { bootTrack, nextDoorTrack, type DoorTrack } from './door-stage';

const REVEAL = {
  duration: duration.curtain,
  ease: ease.emphasized,
  delay: duration.fast,
} as const;

/**
 * Full-screen accent curtain between the landing, sign-in, registration and
 * the hub (ADR 0028). The route changes underneath it. Hub pages share one
 * stage, so moving between them never starts a curtain and the shell fade
 * stays as it is.
 *
 * A cold open of the landing, sign-in or an invite link starts already
 * covered, and stays covered until that screen can be shown. Then it wipes.
 */
export function DoorTransition() {
  const location = useLocation();
  const outlet = useOutlet();
  const [track, setTrack] = useState<DoorTrack>(() => bootTrack(location.pathname));
  const [held, setHeld] = useState(true);
  const holds = useRef(0);
  const generation = useRef(0);
  const next = nextDoorTrack(track, location.pathname, location.state);
  if (next !== track) {
    holds.current = 0;
    setTrack(next);
    if (next.curtain && next.curtain.playId !== track.curtain?.playId) setHeld(true);
  }
  generation.current = track.generation;

  const api = useRef<DoorHoldApi | null>(null);
  if (api.current === null) {
    api.current = {
      hold() {
        const gen = generation.current;
        holds.current += 1;
        setHeld(true);
        let dropped = false;
        return () => {
          if (dropped || generation.current !== gen) return;
          dropped = true;
          holds.current -= 1;
          if (holds.current === 0) setHeld(false);
        };
      },
      ready() {
        if (holds.current === 0) setHeld(false);
      },
    };
  }

  const playId = track.curtain?.playId;
  useLayoutEffect(() => {
    if (playId === undefined) return;
    window.scrollTo(0, 0);
  }, [playId]);

  return (
    <DoorHoldContext.Provider value={api.current}>
      {outlet}
      {track.curtain ? (
        <CurtainReveal
          key={track.curtain.playId}
          label={track.curtain.label}
          held={held}
          onDone={() =>
            setTrack((current) =>
              current.curtain?.playId === track.curtain?.playId ? { ...current, curtain: null } : current,
            )
          }
        />
      ) : null}
    </DoorHoldContext.Provider>
  );
}

/** Mark, then the destination in mono — never the wordmark. */
function CurtainReveal({ label, held, onDone }: { label: string; held: boolean; onDone: () => void }) {
  const reduce = useReducedMotion() === true;
  const done = useRef(onDone);
  done.current = onDone;

  useEffect(() => {
    if (held) return;
    if (reduce) {
      done.current();
      return;
    }
    const fallback = window.setTimeout(() => done.current(), (duration.fast + duration.curtain) * 1000);
    return () => window.clearTimeout(fallback);
  }, [held, reduce]);

  if (reduce) {
    if (!held) return null;
    return (
      <div role="status" aria-label={label} className="fixed inset-0 z-50 flex items-center justify-center bg-accent">
        <CurtainLockup label={label} />
      </div>
    );
  }

  return (
    <m.div
      role={held ? 'status' : undefined}
      aria-label={held ? label : undefined}
      aria-hidden={held ? undefined : true}
      className="fixed inset-0 z-50 flex items-center justify-center bg-accent"
      initial="cover"
      animate={held ? 'cover' : 'clear'}
      variants={{
        cover: { clipPath: 'inset(0% 0% 0% 0%)' },
        clear: { clipPath: 'inset(0% 0% 100% 0%)', transition: REVEAL },
      }}
    >
      <m.div
        variants={{
          cover: { opacity: 1, y: 0 },
          clear: { opacity: 0, y: -40, transition: REVEAL },
        }}
      >
        <CurtainLockup label={label} />
      </m.div>
    </m.div>
  );
}

function CurtainLockup({ label }: { label: string }) {
  return (
    <div className="flex max-w-lg items-center gap-5 px-6 md:gap-8">
      <span className="text-on-accent">
        <Logo variant="mark" height={56} />
      </span>
      <p className="min-w-0 font-mono text-xl text-balance text-on-accent md:text-2xl">{label}</p>
    </div>
  );
}
