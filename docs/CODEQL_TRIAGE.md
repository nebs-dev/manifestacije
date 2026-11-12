# CodeQL triage — first scan, 12 November 2026

24 alerts: 2 critical, 22 high. Each was read in the code, and where the claim
was about behaviour it was measured rather than argued. Five were real and are
fixed. The rest are recorded here with what makes them unreachable, so nobody
has to re-derive it.

Nothing was dismissed in the GitHub UI by this triage. The alerts stay open
until someone with the Security tab decides, and this file is the evidence for
that decision.

---

## Fixed

### #2, #3 — `js/polynomial-redos`, `croatia-geo.ts` · **real**

`/\s+County$/i` in `normalizeCountyName` is quadratic on a run of spaces.
Measured:

| trailing spaces | before | after |
| ---: | ---: | ---: |
| 20 000 | 245 ms | — |
| 80 000 | 4.0 s | — |
| 200 000 | 25 s | — |
| 500 000 | — | **3 ms** |

Reachable: `countyName` is `@IsOptional() @IsString()` in `admin.dto.ts` with
no `MaxLength`, and `city-resolver.ts` also passes a geocoding provider's
response through the same function. Neither source bounds the length.

Fixed with `endsWith` plus `trimEnd`. Regression test asserts a time budget at
50k, 200k and 500k, and that the suffix stripping still behaves.

### #4 — `js/request-forgery`, `admin.service.ts` · **partly real**

Not the host spoof CodeQL implies: `parsed.hostname !== "res.cloudinary.com"`
is an exact comparison on a parsed hostname, which defeats
`https://res.cloudinary.com@evil.example/`,
`https://res.cloudinary.com.evil.example/` and punycode lookalikes alike.

But it used a bare `fetch`, which follows redirects wherever they point — the
check covered the first request only. Now routed through `safeFetch`, so each
hop is re-checked, the connection is pinned to a validated address and the body
is capped.

### #20, #22, #23 — `js/incomplete-url-substring-sanitization` · **real, low impact**

`url.includes("res.cloudinary.com")` treats
`https://evil.example/res.cloudinary.com/x` as one of ours.

- `admin.service.ts` used it to decide an image was already hosted by us, so an
  attacker-controlled URL was stored as the event image instead of being
  re-hosted. The value still passes `safeHttpUrlOrUndefined`, so it is http(s)
  and lands in an `img src` — hotlinking and a tracking pixel, not script.
- `event-image-variants.ts` used it to decide whether to rewrite the path as a
  Cloudinary transform, which produced a broken image for a foreign URL.

Both now compare the parsed hostname. Regression tests cover three impostor
shapes.

### #21 — `js/incomplete-url-substring-sanitization`, `source-forms.tsx` · **real, cosmetic**

`hostname.replace("www.", "")` replaces the first occurrence anywhere rather
than a prefix, so `www.facebook.com.evil.example` becomes
`facebook.com.evil.example` and passes `startsWith("facebook.com")`. It only
selects a warning in the admin form, so the impact is cosmetic, but the check
was wrong. Replaced with an anchored prefix strip and an exact host match.

---

## Not reachable — with the reason

### #5 — `js/request-forgery`, `ssrf.ts` · **the guard itself**

This is the chokepoint. Every iteration of `safeFetch` begins with
`assertPublicHttpUrl(current)` and throws unless it passes; `current` is only
reassigned at the end of the loop body, from a redirect's `Location`, and the
next iteration validates that too. So no value reaches `fetch` without having
been validated immediately before, and since the pinning change the socket can
only reach an address that passed.

CodeQL cannot model a guard expressed as control flow. Covered by 82 tests in
`ssrf.spec.ts` and `ssrf-pinning.spec.ts`, including a hostile resolver that
answers public once and loopback after.

This one cannot be "fixed" — it is the fix. It wants a dismissal, not a patch.

### #1 — `js/polynomial-redos`, `safe-url.ts` · **measured, not reachable**

The sibling of #2/#3, on `MAILTO_LINK`. Measured on the shape CodeQL names
(`mailto:a@` then a run of dots): **0.0 ms at 2 000, 8 000 and 20 000
characters**. The `@` and `/` exclusions in the character classes stop the
engine backtracking across the separator. Left alone rather than churned — a
rewrite here would be change without benefit.

### #6, #17 — `js/insufficient-password-hash` / `js/weak-cryptographic-algorithm`, `uploads.service.ts`

`createHash("sha1").update(payload + secret)` is Cloudinary's documented
request signature, not a password hash. The secret is appended rather than
prepended, which is the order that is not vulnerable to length extension.
CodeQL labels the API secret a password. Cloudinary does support SHA-256 via
`signature_algorithm`; switching is an improvement, not a fix, and belongs in
its own change.

### #7 — `js/insufficient-password-hash`, `auth.spec.ts`

A test file.

### #8, #9, #14, #15 — `htmlToText` in `ai-event-parser.service.ts`

Regex HTML stripping, which CodeQL always flags. The output is not rendered: it
becomes the text of a prompt sent to the model, and the model's reply is
validated field by field against quoted evidence before anything is stored.
Markup surviving the strip is a parsing-quality question, not a security
boundary.

### #10–#13 — `sanitizeDescriptionInput` in `rich-text.ts`

Same class, and the mitigation is stronger: descriptions are stored as plain
text and rendered by the web app as React elements, never as HTML.

Checked rather than taken from the comment, and the first version of this note
was wrong. `dangerouslySetInnerHTML` *does* appear in `apps/web` — in the
JSON-LD `<script type="application/ld+json">` tags on the category and city
pages. That path is not the description renderer, and it is escaped: every
value goes through `safeJsonLdString`, which is
`JSON.stringify(value).replace(/</g, "\\u003c")`, so a description
containing `</script>` cannot close the tag. The description renderer itself
builds React nodes and uses no `innerHTML` at all.

### #16 — `calendar.ts` `stripHtml`

Feeds an `.ics` file, which is `text/calendar`. No HTML context.

### #18 — `js/xss-through-dom`, `source-review.tsx`

`<a href={safeExternalUrl(sourceUrl)}>`. `safeExternalUrl` allows only
`http:`/`https:` and returns undefined for `javascript:`, `data:`, relative
paths and junk — with its own tests in `apps/web/src/lib/safe-url.test.ts`.
CodeQL does not recognise it as a sanitizer.

### #19 — `js/xss-through-dom`, `screenshots-picker.tsx`

`<img src={shot.previewUrl}>` where `previewUrl` comes from
`URL.createObjectURL` on a file the user themselves just picked. A `blob:` URL
in `img src` cannot execute script.

### #24 — `js/loop-bound-injection`, `ai-event-parser.service.ts`

The loop iterates regex match positions found in the source text. The count is
bounded by the text, the body is capped at 5 MB by `safeFetch`, and the work
per position is a slice. Linear, not a blow-up.

---

## Should CodeQL be a required check?

**Not yet, and the reason is mechanical rather than cautious.**

Default setup's pull request check reports on alerts introduced *by that pull
request*, so pre-existing alerts on `main` do not block unrelated work — which
is the behaviour wanted here. But that only holds once `main`'s own baseline is
settled. With 24 alerts open, the first pull request that touches any of those
files risks the check attributing an existing alert to it.

Sequence that gets there without surprises:

1. These five fixes land, so the real ones are gone from `main`.
2. The remaining alerts are dismissed in the Security tab, each with the reason
   from this file. That is a decision for whoever owns the repository; this
   triage is the evidence, not the authority.
3. Re-run the scan and confirm `main` is clean.
4. Only then add `CodeQL` to the required checks in the `main` ruleset.

Adding it before step 3 means a red check nobody can clear without doing step 2
anyway.
