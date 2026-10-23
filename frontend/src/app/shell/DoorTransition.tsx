import { useReducedMotion } from 'motion/react';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useLocation, useOutlet } from 'react-router-dom';
import { Logo } from '@/shared/ui/Logo';
import { duration, ease } from '@/shared/ui/motion';
import { DoorHoldContext, type DoorHoldApi } from './door-hold';
import { bootTrack, nextDoorTrack, type DoorTrack } from './door-stage';

/**
 * Full-screen accent curtain between the landing, registration and
 * the hub (ADR 0028). The route changes underneath it. Hub pages share one
 * stage, so moving between them never starts a curtain and the shell fade
 * stays as it is.
 *
 * Every play rises from the bottom, stays still for at least `curtainHold`
 * (longer, while the screen is not ready), then rises off the top. The travel
 * is CSS, from the first frame — the motion chunk loads later, and waiting
 * for it made the wash appear all at once.
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

function slide(name: 'door-curtain-in' | 'door-curtain-out', curve: readonly [number, number, number, number]) {
  return `${name} ${duration.curtain}s cubic-bezier(${curve.join(', ')}) both`;
}

/** Mark, then the destination in mono — never the wordmark. */
function CurtainReveal({ label, held, onDone }: { label: string; held: boolean; onDone: () => void }) {
  const reduce = useReducedMotion() === true;
  const done = useRef(onDone);
  done.current = onDone;
  const finished = useRef(false);
  const [risen, setRisen] = useState(reduce);
  const [rested, setRested] = useState(false);
  const [left, setLeft] = useState(false);

  useEffect(() => {
    if (risen) return;
    const id = window.setTimeout(() => setRisen(true), duration.curtain * 1000);
    return () => window.clearTimeout(id);
  }, [risen]);

  useEffect(() => {
    if (!risen || rested) return;
    const id = window.setTimeout(() => setRested(true), duration.curtainHold * 1000);
    return () => window.clearTimeout(id);
  }, [risen, rested]);

  useEffect(() => {
    if (!risen || !rested || held || finished.current) return;
    finished.current = true;
    if (reduce) done.current();
    else setLeft(true);
  }, [risen, rested, held, reduce]);

  useEffect(() => {
    if (!left) return;
    const id = window.setTimeout(() => done.current(), duration.curtain * 1000);
    return () => window.clearTimeout(id);
  }, [left]);

  const phase = left ? 'exit' : risen ? 'hold' : 'enter';
  const quiet = phase === 'exit';
  return (
    <div
      role={quiet ? undefined : 'status'}
      aria-label={quiet ? undefined : label}
      aria-hidden={quiet ? true : undefined}
      data-phase={phase}
      className="door-curtain fixed inset-0 z-50 flex items-center justify-center bg-accent"
      style={reduce ? undefined : { animation: phase === 'exit' ? slide('door-curtain-out', ease.exit) : slide('door-curtain-in', ease.emphasized) }}
    >
      <CurtainLockup label={label} />
    </div>
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
