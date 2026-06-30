# Ingestion Smoke Test

Documents the expected behaviour of the full event-source → event → public-feed pipeline.

---

## Automated test

```bash
ADMIN_EMAIL=admin@example.com ADMIN_PASSWORD=secret pnpm smoke:ingestion
```

Requires the API running on port 3001. No external HTTP requests — uses the HTML fixture embedded in `scripts/smoke-ingestion.mjs`.

### What it verifies

| # | Check |
|---|-------|
| 1 | Admin login returns a JWT |
| 2 | `POST /api/admin/event-sources/manual-email` creates an EventSource and triggers parsing |
| 3 | `GET /api/admin/event-sources/:id` returns `parsedJson` (not null) |
| 4 | `parsedJson.candidates[]` is non-empty |
| 5 | `POST /api/admin/event-sources/:id/create-event` with `candidateIndex` creates an Event |
| 6 | `POST /api/admin/events/:id/publish` transitions the event to PUBLISHED |
| 7 | `GET /api/public/events` includes the published event |

---

## Manual walkthrough (Slavonija example)

### 1. Login

Navigate to `http://localhost:3000/admin` and log in with an admin account.

### 2. Submit a source URL

On `/admin/sources`, paste a Slavonija events page URL, e.g.:

```
https://www.tzosijek.hr/dogadanja/
```

The API will:
- `GET` the URL server-side
- Store the raw HTML as `EventSource.rawHtml`
- Call `AiEventParserService.parseBatch()` via OpenAI
- Store the result in `EventSource.parsedJson`

### 3. Expected EventSource shape

```jsonc
{
  "id": 1,
  "type": "URL",
  "status": "PARSED",
  "sourceUrl": "https://www.tzosijek.hr/dogadanja/",
  "parsedJson": {
    "sourceUrl": "https://www.tzosijek.hr/dogadanja/",
    "sourceType": "batch",
    "candidates": [
      {
        "title": "Ljetni jazz festival",
        "startsAt": "2025-07-11T20:00:00",
        "city": "Osijek",
        "venueName": "Gradski park",
        "isFree": true,
        "confidence": 0.85,
        "missingFields": [],
        "warnings": [],
        "_status": "pending"
      }
      // ... more candidates
    ]
  }
}
```

### 4. Review candidates at `/admin/sources/:id`

Each candidate card shows:
- Title, date/time, venue, city
- Confidence badge (green ≥ 0.8 / yellow ≥ 0.6 / red < 0.6)
- Missing fields warning
- **Kreiraj događaj** button → calls `POST /api/admin/event-sources/:id/create-event` with `{ candidateIndex: N }`
- **Ignoriraj** button → marks candidate as ignored

After creating an event the card shows `Kreiran → Event #N` with a link to `/admin/events/:id`.

### 5. Approve and publish

On `/admin/events/:id`:
1. Review and edit fields as needed
2. Click **Odobri** → status moves to `APPROVED`
3. Click **Objavi** → status moves to `PUBLISHED`

Or use the quick-action buttons on `/admin/events/pending`.

### 6. Verify public feed

```bash
curl http://localhost:3001/api/public/events | jq '.[0].title'
```

The published event should appear. It is also visible at `http://localhost:3000/eventi`.

---

## Parser behaviour notes

- `parseBatch()` splits the HTML into date-boundary blocks and calls the LLM once per block
- A single EventSource can produce multiple candidates (`sourceType: "batch"`)
- Candidates with missing `title`, `startsAt`, or `city` are flagged but still stored
- Re-parsing (`POST /api/admin/event-sources/:id/reparse`) replaces `parsedJson` but preserves already-created events (their `_status` stays `"created"`)

---

## Fixture

The automated script uses this fixture HTML (three synthetic Osijek events):

```html
<article class="event">
  <h2>Ljetni jazz festival</h2>
  <p class="date">Petak, 11. srpnja 2025. u 20:00</p>
  <p class="venue">Gradski park, Osijek</p>
  <p class="price">Ulaz slobodan</p>
</article>
<!-- + 2 more articles -->
```

This avoids flakiness from live website changes and rate limits.
