# Post-deploy smoke test: egress guard

Run after the security fix reaches production. Takes a few minutes. Nothing
here writes to a real organizer's data, deletes anything, or spends an AI call.

**Before you start:** have the Railway deploy logs open in a second window.
Every refusal is logged there, and the log line is the actual evidence — the
API answers the submitter the same way whether a URL was refused or merely
unreachable, by design.

---

## 1. The API is up and talking to its database

```bash
curl -s https://manifestacije-production.up.railway.app/api/health | jq
```

Expect `db: "ok"`. If `env` is in the response, note what it says — step 5
uses it.

## 2. A legitimate public source still parses

This is the check that matters most: a guard that blocks real sources is worse
than no guard.

In the admin, open **Izvori** and submit a real event page you would normally
ingest — an `entrio.hr` listing is the usual one. Use the **Link** form.

- Expect: the source is created and candidates appear, exactly as before.
- In the logs: no `refused` line for that request.

If this fails, stop and roll back. The guard is rejecting something it should
allow, and the log line will name the address it resolved to.

## 3. A destination that should be refused is refused, and shows nothing

Still in the admin, submit a link whose host is a loopback address — the
plainest case, `http://127.0.0.1/` — through the same form.

Expect, in the admin:

- the source row is created (submissions are always kept), and
- it has **no fetched page content**: `rawHtml` and `rawText` stay empty, no
  candidates are produced, and the source lands in review.

Expect, in the Railway logs, one line of the shape:

```
WARN [OrganizerService] organizer submission refused: Refusing to fetch ...
```

The admin shows only a generic "link not allowed" message. That is intended:
a detailed reason in the response would let the form be used to map the
network behind it.

**Do not** probe cloud metadata addresses or internal service names from
production as part of this check. The loopback case proves the guard is
active; the rest is covered by `apps/api/test/ssrf.spec.ts`, which runs in CI
on every pull request.

## 4. Ordinary work is unaffected

- Create an event from a parsed candidate and publish it. It should appear on
  the public page as usual.
- Open the organizer side and submit a plain text (no link) description. It
  should be stored and parsed as before — this path never fetched anything, so
  it must be untouched.
- Delete the test source and any test event you created.

## 5. Confirm the API's actual Node version

This has never been declared in the repository, so it is whatever the builder
chose. Find it one of these ways:

- Railway → the API service → **Deployments** → the latest build log; the
  nixpacks output names the Node version it installed, or
- Railway → the service → **Shell** (if available) → `node -v`

Write the result down. If it is below 18, the egress guard's `fetch` and
`Response` usage would not work — but the API already uses `fetch` today, so
in practice this is a confirmation, not a risk.

Then pin it deliberately, following `docs/NODE_VERSION.md`:
Railway → Variables → `NIXPACKS_NODE_VERSION` = `24` (a major, not a patch
version), redeploy, and confirm with the build log.

## 6. Watch the logs for a day

The one thing a test suite cannot tell you is whether some real source you
ingest resolves to an address the guard dislikes — a provider behind an unusual
DNS setup, for instance. Those show up as `refused` lines naming a real,
previously working host.

```
Railway → the API service → Logs → filter: refused
```

No such lines over a normal day's ingestion means the guard is not getting in
the way.

---

## Rolling back

The change is one commit touching `apps/api` only. Revert that commit, push to
`main`, and Railway redeploys. Nothing in it changes the database, so there is
no migration to undo.
