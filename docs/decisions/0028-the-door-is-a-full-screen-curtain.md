# 0028. The door is a full-screen curtain

- **Status:** Accepted
- **Date:** 2026-10-24
- **Related:** [0011](./0011-visual-identity.md) ·
  [0012](./0012-motion-and-animated-icons.md)

## Context

The signed-out door is a few screens: the landing (the sign-in form lives on
it), the separate sign-in page an invite or a finished session still opens,
and registration. Staff asked for the same kind of transition a studio site
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
| The landing, including back from sign-in and signing out | Source One |
| Registration, including a fresh invite link | Source One Internal Registration |
| The sign-in page | Sign in |
| The hub, only after a sign-in just succeeded | welcome back! |

The wash is covering as the screen changes, in `bg-accent`, with the mark
(never the wordmark) and a mono line. It holds for 120ms, then wipes up over
600ms (`curtain`, after a `fast` hold). The route changes underneath, so a
gate that redirects cannot run twice against a page that is still leaving.

A cold open of the landing, sign-in, or an invite link starts on that wash
and stays there until the screen can be shown. The landing waits for the
session check. Registration waits for the invite. Sign-in waits until its
page is up. A server that is still waking, or a link whose invite has not
loaded, stays on the wash instead of a skeleton, and wipes once the answer
is in — the form, the dead-link sentence, or try again. Refreshing a hub
page does not do this.
Hub pages keep ADR 0012's fade, because they share one stage and the shell
does not remount. An already-signed-in visit to `/` that hops to Atlas does
not play "welcome back!" — that line is only for a sign-in just completed.
Reduced motion skips the wipe. The wash stays still until the screen is
ready, then it is gone.

## Alternatives considered

**The same curtain between hub pages.** Rejected: the skeleton and the short
fade already say where you went, and 1.3s on every click is too much for a
tool.

**A curtain no longer than 320ms, so ADR 0012 could stay untouched.** Rejected:
"Source One Internal Registration" has to be readable, and the cover-then-reveal
is the transition that was asked for. 320ms cannot hold both.

**The wordmark on the wash.** Rejected: the mark and a mono line, not the
full lockup.

## Consequences

Door crossings hold the name for a moment, then take 600ms to clear. That is
deliberate and limited to those crossings. A cold open can hold much longer:
the wash stays up for as long as the session or the invite takes, including a
server that is still waking, and only then takes 600ms to clear. A new door
screen needs a line in `doorStage` and, if it should announce itself, a label.
Entering the hub without the welcome flag stays instant, so session redirects
do not perform. The screen tells the curtain when it can be shown
(`useDoorHold`); a door screen that forgets to leaves the wash up.
