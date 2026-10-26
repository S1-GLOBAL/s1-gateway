# 0028. The door is a full-screen curtain

- **Status:** Accepted
- **Date:** 2026-10-24
- **Related:** [0011](./0011-visual-identity.md) ·
  [0012](./0012-motion-and-animated-icons.md)

## Context

The signed-out door is the landing, where the only sign-in form lives, and
registration. An old `/sign-in` address opens that same landing. Staff asked
for the same kind of transition a studio site
uses when it changes page: a full-screen wash in the brand colour, the mark,
and the name of the screen you are heading to. They named the words.

Inside the hub the short fade already explains the move, and a curtain on
every Atlas page would make a tool used all day feel slow. ADR 0012 set 320ms
as the longest page transition and said anything longer needs its own record.

## Decision

**A full-screen accent curtain plays only when crossing the door.** The wash
is `bg-accent`, the mark is the logo's mark (never the wordmark), and the
line beside it is mono:

| You are opening | The line |
|---|---|
| The landing, including signing out and an old `/sign-in` address | Source One |
| Registration, including a fresh invite link | Source One Internal Registration |
| The hub, only after a sign-in just succeeded | welcome back! |

The wash is `bg-accent`, with the mark (never the wordmark) and a mono line.
It rises from the bottom over 600ms (`curtain`, `ease.emphasized`), stays
still for at least 2 seconds (`curtainHold`) so the line can be read, then
rises off the top over 600ms (`ease.exit`). A screen that is already loaded
does not shorten that still time. The route changes underneath, so a gate
that redirects cannot run twice against a page that is still leaving. The
travel is CSS and starts on the first frame. The motion feature chunk loads
after first paint, and a curtain that waited for it appeared all at once.

A cold open of the landing or an invite link rises the same way and stays
until the screen can be shown. The landing waits for the session check.
Registration waits for the invite. An old `/sign-in` address is that same
landing. A server that is still waking, or a link whose invite has not loaded,
stays on the wash instead of a skeleton. When the answer is in — the form,
the dead-link sentence, or try again — the wash still finishes its 2 seconds,
then rises away. Refreshing a hub page does not do this.
Hub pages keep ADR 0012's fade, because they share one stage and the shell
does not remount. An already-signed-in visit to `/` that hops to Atlas does
not play "welcome back!" — that line is only for a sign-in just completed.
Reduced motion skips both rises. The wash stays still for the same minimum,
then it is gone.

## Alternatives considered

**The same curtain between hub pages.** Rejected: the skeleton and the short
fade already say where you went, and a rise, a 2 second hold and a rise away
on every click is too much for a tool.

**A curtain no longer than 320ms, so ADR 0012 could stay untouched.** Rejected:
"Source One Internal Registration" has to be readable, and the cover-then-reveal
is the transition that was asked for. 320ms cannot hold both.

**The wordmark on the wash.** Rejected: the mark and a mono line, not the
full lockup.

## Consequences

While the curtain is mounted the document does not scroll, and the reserved
scrollbar gutter is dropped, so the wash is the only thing in the window.

Door crossings take 600ms to cover, hold the name for at least 2 seconds,
then take 600ms to clear. That is deliberate and limited to those crossings.
A cold open can hold longer: the wash stays up for as long as the session or
the invite takes, including a server that is still waking, and for at least
2 seconds even when that answer is already in, and only then takes 600ms to
clear. A new door screen needs a line in `doorStage` and, if it should
announce itself, a label. Entering the hub without the welcome flag stays
instant, so session redirects do not perform. The screen tells the curtain
when it can be shown (`useDoorHold`); a door screen that forgets to call it
leaves the wash up.
