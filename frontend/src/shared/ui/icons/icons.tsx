import type { Variants } from 'motion/react';
import * as m from 'motion/react-m';
import { ease } from '../motion';
import { IconSvg, iconCentre, ownCentre, type IconProps } from './icon-svg';

/*
 * Stroke-animated icons — ADR 0012. Paths from Lucide (see LUCIDE-LICENSE.txt).
 *
 * Every stroke is its own element with its own variants. `rest` is the drawn
 * icon; `active` is a short keyframe sequence that always ends back on the
 * rest pose, so an icon left in `active` (a nav item on the current page)
 * looks exactly like one at rest. Nothing loops.
 */

const SNAP = { duration: 0 };

/* ---------------------------------------------------------------- Tools -- */

/** Four app tiles; each dips and springs back in turn, clockwise. */
const tile: Variants = {
  rest: { scale: 1 },
  active: (order: number) => ({
    scale: [1, 0.55, 1.08, 1],
    transition: { duration: 0.5, delay: order * 0.06, ease: ease.standard },
  }),
};

export function ToolsIcon(props: IconProps) {
  return (
    <IconSvg {...props}>
      <m.rect custom={0} variants={tile} style={ownCentre} width="7" height="7" x="3" y="3" rx="1" />
      <m.rect custom={1} variants={tile} style={ownCentre} width="7" height="7" x="14" y="3" rx="1" />
      <m.rect custom={2} variants={tile} style={ownCentre} width="7" height="7" x="14" y="14" rx="1" />
      <m.rect custom={3} variants={tile} style={ownCentre} width="7" height="7" x="3" y="14" rx="1" />
    </IconSvg>
  );
}

/* ---------------------------------------------------------------- Theme -- */

/** The palette stays; its four paint dots pop in sequence. */
const paint: Variants = {
  rest: { scale: 1 },
  active: (order: number) => ({
    scale: [1, 0, 1.6, 1],
    transition: { duration: 0.45, delay: 0.05 + order * 0.07, ease: ease.standard },
  }),
};

export function ThemeIcon(props: IconProps) {
  return (
    <IconSvg {...props}>
      <path d="M12 22a1 1 0 0 1 0-20 10 9 0 0 1 10 9 5 5 0 0 1-5 5h-2.25a1.75 1.75 0 0 0-1.4 2.8l.3.4a1.75 1.75 0 0 1-1.4 2.8z" />
      <m.circle custom={0} variants={paint} style={ownCentre} cx="6.5" cy="12.5" r=".5" fill="currentColor" />
      <m.circle custom={1} variants={paint} style={ownCentre} cx="8.5" cy="7.5" r=".5" fill="currentColor" />
      <m.circle custom={2} variants={paint} style={ownCentre} cx="13.5" cy="6.5" r=".5" fill="currentColor" />
      <m.circle custom={3} variants={paint} style={ownCentre} cx="17.5" cy="10.5" r=".5" fill="currentColor" />
    </IconSvg>
  );
}

/* ------------------------------------------------------------- Accounts -- */

/** Primary person stays; the second joins with a short pop. */
const join: Variants = {
  rest: { scale: 1, opacity: 1 },
  active: {
    scale: [1, 0.6, 1.12, 1],
    opacity: [1, 0.4, 1, 1],
    transition: { duration: 0.5, ease: ease.standard },
  },
};

export function AccountsIcon(props: IconProps) {
  return (
    <IconSvg {...props}>
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <m.g variants={join} style={iconCentre}>
        <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
        <path d="M16 3.13a4 4 0 0 1 0 7.75" />
      </m.g>
    </IconSvg>
  );
}

/* ------------------------------------------------------------------ Sun -- */

const core: Variants = {
  rest: { scale: 1 },
  active: { scale: [1, 0.78, 1], transition: { duration: 0.45, ease: ease.standard } },
};

/** Each ray retracts and grows back in turn, clockwise from the top. */
const ray: Variants = {
  rest: { pathLength: 1, opacity: 1 },
  active: (order: number) => ({
    pathLength: [1, 0, 1],
    opacity: [1, 0, 1],
    transition: { duration: 0.4, delay: order * 0.04, ease: ease.standard },
  }),
};

const SUN_RAYS = [
  'M12 2v2',
  'm19.07 4.93-1.41 1.41',
  'M20 12h2',
  'm17.66 17.66 1.41 1.41',
  'M12 20v2',
  'm6.34 17.66-1.41 1.41',
  'M2 12h2',
  'm4.93 4.93 1.41 1.41',
];

export function SunIcon(props: IconProps) {
  return (
    <IconSvg {...props}>
      <m.circle variants={core} style={ownCentre} cx="12" cy="12" r="4" />
      {SUN_RAYS.map((d, order) => (
        <m.path key={d} custom={order} variants={ray} d={d} />
      ))}
    </IconSvg>
  );
}

/* ----------------------------------------------------------------- Moon -- */

/** The crescent rocks; its star blinks out and back. */
const crescent: Variants = {
  rest: { rotate: 0 },
  active: { rotate: [0, -18, 8, 0], transition: { duration: 0.55, ease: ease.standard } },
};

const star: Variants = {
  rest: { scale: 1, opacity: 1 },
  active: {
    scale: [1, 0, 1.3, 1],
    opacity: [1, 0, 1, 1],
    transition: { duration: 0.45, delay: 0.12, ease: ease.standard },
  },
};

export function MoonIcon(props: IconProps) {
  return (
    <IconSvg {...props}>
      <m.path
        variants={crescent}
        style={ownCentre}
        d="M20.985 12.486a9 9 0 1 1-9.473-9.472c.405-.022.617.46.402.803a6 6 0 0 0 8.268 8.268c.344-.215.825-.004.803.401"
      />
      <m.g variants={star} style={ownCentre}>
        <path d="M18 5h4" />
        <path d="M20 3v4" />
      </m.g>
    </IconSvg>
  );
}

/* -------------------------------------------------------------- Monitor -- */

/** The screen redraws; the stand drops into place under it. */
const screen: Variants = {
  rest: { pathLength: 1 },
  active: { pathLength: [1, 0, 1], transition: { duration: 0.55, ease: ease.standard } },
};

const stand: Variants = {
  rest: { y: 0, opacity: 1 },
  active: {
    y: [0, -3, 0],
    opacity: [1, 0, 1],
    transition: { duration: 0.4, delay: 0.18, ease: ease.standard },
  },
};

export function MonitorIcon(props: IconProps) {
  return (
    <IconSvg {...props}>
      <m.rect variants={screen} width="20" height="14" x="2" y="3" rx="2" />
      <m.g variants={stand}>
        <line x1="8" x2="16" y1="21" y2="21" />
        <line x1="12" x2="12" y1="17" y2="21" />
      </m.g>
    </IconSvg>
  );
}

/* -------------------------------------------------------- External link -- */

/** The arrow leaves through the corner and comes back in from inside the box. */
const arrow: Variants = {
  rest: { x: 0, y: 0, opacity: 1 },
  active: {
    x: [0, 5, -5, 0],
    y: [0, -5, 5, 0],
    opacity: [1, 0, 0, 1],
    transition: { duration: 0.5, times: [0, 0.35, 0.36, 1], ease: ease.standard },
  },
};

export function ExternalLinkIcon(props: IconProps) {
  return (
    <IconSvg {...props}>
      <m.g variants={arrow}>
        <path d="M15 3h6v6" />
        <path d="M10 14 21 3" />
      </m.g>
      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
    </IconSvg>
  );
}

/* ----------------------------------------------------------------- Plus -- */

/** The horizontal stroke redraws, then the vertical. */
const bar: Variants = {
  rest: { pathLength: 1 },
  active: (order: number) => ({
    pathLength: [1, 0, 1],
    transition: { duration: 0.35, delay: order * 0.1, ease: ease.standard },
  }),
};

export function PlusIcon(props: IconProps) {
  return (
    <IconSvg {...props}>
      <m.path custom={0} variants={bar} d="M5 12h14" />
      <m.path custom={1} variants={bar} d="M12 5v14" />
    </IconSvg>
  );
}

/* -------------------------------------------------------------- Sidebar -- */

/** The panel stays; the chevron nudges the way the sidebar will move. */
const nudge: Variants = {
  rest: { x: 0 },
  active: (direction: number) => ({
    x: [0, direction * 2.5, 0],
    transition: { duration: 0.4, ease: ease.standard },
  }),
};

export function SidebarIcon({ collapsed = false, ...props }: IconProps & { collapsed?: boolean }) {
  return (
    <IconSvg {...props}>
      <rect width="18" height="18" x="3" y="3" rx="2" />
      <path d="M9 3v18" />
      <m.path custom={collapsed ? 1 : -1} variants={nudge} d={collapsed ? 'm14 9 3 3-3 3' : 'm16 15-3-3 3-3'} />
    </IconSvg>
  );
}

/* ---------------------------------------------------------------- Check -- */

const tick: Variants = {
  rest: { pathLength: 1 },
  active: { pathLength: [0, 1], transition: { duration: 0.35, ease: ease.emphasized } },
};

export function CheckIcon(props: IconProps) {
  return (
    <IconSvg {...props}>
      <m.path variants={tick} d="M20 6 9 17l-5-5" />
    </IconSvg>
  );
}

/* ---------------------------------------------------------------- Alert -- */

/** The ring shakes; the mark inside drops and settles. */
const ring: Variants = {
  rest: { x: 0 },
  active: { x: [0, -1.5, 1.5, -1, 0], transition: { duration: 0.4, ease: 'easeInOut' } },
};

const mark: Variants = {
  rest: { y: 0 },
  active: { y: [0, -1.5, 0], transition: { duration: 0.35, delay: 0.1, ease: ease.standard } },
};

export function AlertIcon(props: IconProps) {
  return (
    <IconSvg {...props}>
      <m.circle variants={ring} cx="12" cy="12" r="10" />
      <m.g variants={mark}>
        <line x1="12" x2="12" y1="8" y2="12" />
        <line x1="12" x2="12.01" y1="16" y2="16" />
      </m.g>
    </IconSvg>
  );
}

/* -------------------------------------------------------------- Refresh -- */

/**
 * Each half turns a half-turn about the centre, the second a beat behind.
 * The icon is symmetric under a half-turn, so `rest` snaps back unseen.
 */
const half: Variants = {
  rest: { rotate: 0, transition: SNAP },
  active: (order: number) => ({
    rotate: 180,
    transition: { duration: 0.5, delay: order * 0.06, ease: ease.emphasized },
  }),
};

export function RefreshIcon(props: IconProps) {
  return (
    <IconSvg {...props}>
      <m.g custom={0} variants={half} style={iconCentre}>
        <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" />
        <path d="M21 3v5h-5" />
      </m.g>
      <m.g custom={1} variants={half} style={iconCentre}>
        <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" />
        <path d="M8 16H3v5" />
      </m.g>
    </IconSvg>
  );
}

/* -------------------------------------------------------------- Offline -- */

/** The signal fades out from the outermost arc in; the slash redraws. */
const signal: Variants = {
  rest: { opacity: 1 },
  active: (order: number) => ({
    opacity: [1, 0.15, 1],
    transition: { duration: 0.6, delay: order * 0.08, ease: 'easeInOut' },
  }),
};

const slash: Variants = {
  rest: { pathLength: 1 },
  active: { pathLength: [1, 0, 1], transition: { duration: 0.5, ease: ease.standard } },
};

export function WifiOffIcon(props: IconProps) {
  return (
    <IconSvg {...props}>
      <m.path custom={3} variants={signal} d="M12 20h.01" />
      <m.path custom={2} variants={signal} d="M8.5 16.429a5 5 0 0 1 7 0" />
      <m.path custom={1} variants={signal} d="M5 12.859a10 10 0 0 1 5.17-2.69" />
      <m.path custom={1} variants={signal} d="M19 12.859a10 10 0 0 0-2.007-1.523" />
      <m.path custom={0} variants={signal} d="M2 8.82a15 15 0 0 1 4.177-2.643" />
      <m.path custom={0} variants={signal} d="M22 8.82a15 15 0 0 0-11.288-3.764" />
      <m.path variants={slash} d="m2 2 20 20" />
    </IconSvg>
  );
}
