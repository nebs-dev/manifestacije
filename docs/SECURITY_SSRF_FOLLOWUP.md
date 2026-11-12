# Pinning the validated address (DNS rebinding)

**Status:** fixed. This document now records how, and what is left.

## The gap

`apps/api/src/common/ssrf.ts` validates every URL the server fetches on a
user's behalf. But a hostname was resolved once for the check and again when
the socket opened, so a DNS server answering differently between those two
moments could point the connection somewhere the check never saw. This is the
standard time-of-check/time-of-use gap in any guard that validates a hostname
rather than a connection.

## The fix

`assertPublicHttpUrl` now returns the addresses that passed, and `safeFetch`
hands those to an undici `Agent` through `connect.lookup`, so the socket can
only go to an address the guard already approved. Nothing else about the
transport changed: it is still `fetch`, still manual redirects with each hop
re-checked, still the same response cap and time budget.

`apps/api/test/ssrf-pinning.spec.ts` proves it against a hostile resolver —
one that answers with a public address the first time, so the check passes,
and a loopback address every time after, which is what a rebinding attack
does. Real sockets and a real local server, because the point is what the
transport does; a mocked `fetch` could not show it.

## Why the undici version is pinned exactly

An `Agent` from the wrong undici is rejected by Node's own `fetch` with
`TypeError: fetch failed — invalid onRequestStart method`. This was measured,
not assumed, on the versions this project runs:

| undici | Node 22.13.0 | Node 22.23.4 (production) | Node 24.22.2 | Node 26.5.0 |
| --- | --- | --- | --- | --- |
| 8.12.4 | fails to import | rejected | rejected | works |
| **7.30.2** | **works** | **works** | **works** | **works** |
| 6.29.1 | works | works | not measured | not measured |

So `undici` is a runtime dependency pinned to `7.30.2`, not a range. It must
stay a `dependencies` entry rather than `devDependencies`: the API's build
installs production dependencies only, so a dev-only entry would be missing at
runtime.

Treat an undici or Node upgrade as a change that needs this table re-measured.
`ssrf-pinning.spec.ts` fails loudly if the combination stops working, which is
the point of having it.

## What this does not cover

- **Pinning follows the guard, not the other way round.** If
  `assertPublicHttpUrl` ever returns an address it should not have, the
  connection goes there. The address classifier is what keeps that honest, and
  it has its own tests.
- **A host that is legitimately multi-homed** is pinned to the first validated
  address for the whole call, including across redirects to the same host.
  That is a small availability trade, not a correctness problem: every address
  was validated before any of them was used.
