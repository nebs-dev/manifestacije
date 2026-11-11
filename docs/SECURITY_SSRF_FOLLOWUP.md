# Follow-up: pinning the validated address (DNS rebinding)

**Status:** open, small, not urgent. Separate from the egress guard, which is
shipped.

## What is already handled

`apps/api/src/common/ssrf.ts` validates every URL the server fetches on a
user's behalf: scheme, hostname, every address the name resolves to, and every
redirect hop. It also caps the response size and the time budget for the whole
call. All of that is covered by `apps/api/test/ssrf.spec.ts`.

## What is left

The name is resolved once for the check and again when the socket is opened.
A DNS server that answers differently between those two moments can point the
connection somewhere the check did not see. This is the standard
time-of-check/time-of-use gap in any guard that validates a hostname rather
than a connection, and the usual remedy is to connect to the address that was
validated instead of resolving again.

## Why it is not in the hotfix

The obvious mechanism is an undici `Agent` with a custom `connect.lookup`,
handed to `fetch` as `dispatcher`. That was measured against the runtimes this
project actually uses, with undici 8.12.4:

| Node | Result |
| --- | --- |
| 22.13.0 | undici 8 fails to import (`createZstdDecompress` is undefined) |
| **24.22.2** | `TypeError: fetch failed — invalid onRequestStart method` |
| 26.5.0 | works |

Node 24 is the configured runtime for the deployed web project, so shipping
this would mean a security control that only works on some of our Node
versions and breaks the API on the rest. An older undici pinned to match each
Node release's internal copy would be worse: a silent coupling that breaks on
the next Node upgrade, in a security control.

## Options for the follow-up

1. **undici's own `request()`** instead of global `fetch`, with the Agent from
   the same package. No version mismatch, because nothing is handed across to
   Node's internal copy. Cost: `safeFetch` returns something other than a
   `Response`, or has to adapt one.
2. **`node:https.request` with the `lookup` option.** No new dependency and a
   stable API. Cost: `safeFetch` has to reimplement body reading and content
   decoding, which `fetch` does today.
3. **Wait.** Re-measure option 1's dispatcher path after the next Node or
   undici release; it may simply start working.

Option 1 is the likely choice. Either way the change is contained to
`ssrf.ts` — no call site needs to know.

## Acceptance criteria

- A connection made through `safeFetch` goes to an address that passed
  `assertPublicHttpUrl`, not to whatever a second resolution returns.
- A test proves it: a resolver that answers public first and private second
  must not produce a connection to the private address.
- Everything already in `ssrf.spec.ts` still passes.
- Verified on the Node version in `.nvmrc` and on the deployed runtime.

## Risk in the meantime

Exploiting this needs control of an authoritative DNS server, a very short
record lifetime, and a win in the race between our check and the connection.
The egress guard blocks the straightforward attempts, which is the bulk of
the exposure. Tracking it here rather than leaving it in a commit message.
