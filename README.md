# Relay — AI meeting action router

![Relay commercial site](assets/screen-overview.png)

**Live site:** https://s20260125-prog.github.io/hihihi/  
**Interactive app:** https://s20260125-prog.github.io/hihihi/app.html  
**Authors:** 1E Tiffany, Trevor

Relay turns a meeting recording or transcript into **owned, dated, routed action items**: transcribe → extract structured actions → review → push to Notion, Jira, or Trello.

This repository now contains two connected surfaces:

1. **A bilingual commercial website** (`index.html`) with Traditional Chinese and English content, product story, workflow, live screenshots, integrations, pricing, FAQ, and author credits.
2. **The original interactive product demo** (`app.html`) preserved as a fully working application. The marketing site links into it, and the demo links back to the site.

No API keys or build step are required for the demo.

## Try it

Open the live site, or run the folder locally:

```bash
python3 -m http.server 8000
# http://localhost:8000
```

- **Language:** the site defaults to Traditional Chinese. Use the `繁中 / EN` switch to change the whole marketing site. The choice is stored in `localStorage` and reflected in the URL (`?lang=en`).
- **Guided demo:** “Load sample” fills a Q4 launch transcript. Click **Extract action items**, review the five actions, then **Push tasks** to see the mock Notion/Jira/Trello handoff.
- **Deep links:** `/app.html?demo=1` opens the guided sample, `/app.html?review=q4-launch` opens the review screen directly, and `/app.html#integrations` opens integration settings.

The interactive app uses English sample data. The commercial site is fully bilingual.

## What was improved

- The marketing site explains the product in depth: problem, four-step workflow, product screens, feature set, real sample meeting, routing rules, integrations, security posture, pricing, FAQ, and team.
- The original app was moved to `app.html` and kept working, with a clear “back to site” route in the app top bar and sidebar logo.
- The import flow now explains itself: a guided three-step header, a prominent sample-meeting callout, a “sample loaded” next-step message, and honest demo-mode notes for audio upload.
- Added deep links for the guided demo and sample review so the marketing CTAs land in the most useful place.
- Added bilingual metadata, `hreflang` alternates, responsive navigation, keyboard-accessible FAQ, and automatic GitHub Pages deployment.

## Files

| File | Purpose |
| --- | --- |
| `index.html` | Bilingual commercial website |
| `site.css` | Commercial-site design system and responsive layout |
| `site.js` | Language switch, mobile navigation, product tabs, reveal animations |
| `app.html` | Interactive Relay product demo |
| `styles.css` | App design system and responsive layout |
| `app.js` | Seed data, extraction demo, review/routing flow, modals |
| `assets/` | Product screenshots used by the site and README |
| `.github/workflows/deploy-pages.yml` | Deploy to GitHub Pages on every push/merge to `main` |

## Product demo features

- **Overview** — meeting inbox, time saved, routing stats, upcoming meeting, activity feed, connected tools.
- **Review & route** — edit titles/owners/dates/destinations, add/remove actions, bulk-route, and push. A success receipt shows the mock records created.
- **New meeting** — paste a transcript or load the sample. Relay runs staged extraction and returns editable actions with owners, due dates, priorities, destinations, and confidence scores.
- **Extraction heuristics** — speaker labels, commitments (`I'll`, `can you`, `please`, `we need to`), relative dates (`by Friday`, `next Tuesday`, `end of day`), urgency cues, and likely destinations. This is a deterministic stand-in for the production LLM step.
- **Meetings / Action items** — filter by status, search, mark done, and open the source meeting.
- **Integrations** — connect/disconnect tools, configure destinations, toggle routing rules, copy the webhook endpoint, and send a test event.
- **Command menu** — `⌘K` / `Ctrl+K` to search meetings and actions.
- **Responsive** — mobile navigation, stacked cards, touch-sized controls, and bottom-sheet modals.

Data is in-memory, so refreshing resets the demo. Audio upload is a UI simulation in the static build: it runs the sample transcript through extraction rather than calling Whisper. Real transcription, LLM extraction, and tool writes live on the server side described below.

## Deployment

GitHub Pages is configured to build with GitHub Actions. The workflow in `.github/workflows/deploy-pages.yml` runs on every push to `main` (including PR merges) and on manual dispatch. It publishes `index.html`, `app.html`, `site.css`, `site.js`, `styles.css`, `app.js`, and `assets/`.

## Production architecture

The demo intentionally stops at the browser boundary. The real service should keep provider keys and OAuth tokens server-side.

```text
Zoom / Meet / Fireflies ──▶ ingest webhook
                               │
                    ┌──────────▼──────────┐
                    │ Transcription       │  Deepgram (live) / Whisper (batch)
                    │ + speaker diarize   │
                    └──────────┬──────────┘
                               │ transcript + participant roster
                    ┌──────────▼──────────┐
                    │ LLM extraction      │  JSON schema + source quotes
                    │ + owner resolution  │  roster match → calendar → fallback
                    └──────────┬──────────┘
                               │ draft actions
                    ┌──────────▼──────────┐
                    │ Human review        │  this UI
                    │ approve / edit      │
                    └──────────┬──────────┘
                               │ approved actions
              ┌────────────────┼────────────────┐
              ▼                ▼                ▼
           Notion            Jira             Trello
         database item     issue + sprint     card + list
                               │
                    Slack notification / audit log
```

### 1. Ingest

Support three entry points:

- **Recording URL** from Zoom/Meet/Fireflies; download with the provider token and submit to Whisper or Deepgram.
- **Live audio** via Deepgram streaming for in-meeting capture.
- **Transcript paste/upload** for teams that already have notes.

Normalize the raw transcript into `{ speaker, start_ms, end_ms, text }` turns so extraction can cite `source_quote` spans.

### 2. Extract with a strict JSON contract

Use function calling / structured outputs so the model cannot return prose. Example response:

```json
{
  "meeting": {
    "title": "Q4 Launch — Weekly Sync",
    "summary": "The team held the Nov 4 launch date…",
    "decisions": ["Launch date locked: Nov 4", "Pricing copy is the gating item"]
  },
  "action_items": [
    {
      "title": "Finalize the pricing page copy and send it to legal",
      "owner": "Priya Shah",
      "due_date": "2026-10-30",
      "priority": "high",
      "destination": "notion",
      "confidence": 0.96,
      "source_quote": "I'll finalize the pricing page copy and send it to legal by Friday."
    }
  ]
}
```

Guardrails:

- Resolve owners against the participant roster; surface low-confidence matches instead of guessing.
- Resolve relative dates against the meeting date and the organizer's time zone.
- Keep a source quote for every action so the reviewer can verify it.
- Validate with the schema, then run deterministic routing rules (urgent → Jira, legal/copy → Notion, social/assets → Trello).
- Never route an item below the confidence threshold without human review.

### 3. Route adapters

| Tool | Create call | Useful fields |
| --- | --- | --- |
| Notion | `POST /v1/pages` | database_id, title, owner, due date, priority, source URL |
| Jira | `POST /rest/api/3/issue` | project key, summary, description, duedate, labels, assignee |
| Trello | `POST /1/cards` | idList, name, desc, due, idMembers |
| Slack | `POST /api/chat.postMessage` | channel, owner mention, deep link to the created record |
| Zapier | Webhook subscription / action | fan out `action.routed` events to any of 6,000+ apps |

Operational requirements:

- **Idempotency key** per `(meeting_id, action_id, destination)` so retries do not create duplicates.
- Store the external record ID and URL on the action, and show them in the success receipt.
- Retry with exponential backoff; dead-letter failed routes and surface them in the UI.
- Use OAuth per workspace, encrypt refresh tokens at rest, and never expose them to the client.
- Add an HMAC signature and timestamp check to inbound webhooks.

### 4. Webhook API

The demo exposes a sample endpoint in the Integrations page:

```http
POST https://api.relay.app/v1/meetings/ingest
Content-Type: application/json
X-Relay-Signature: sha256=…

{
  "meeting": {
    "title": "Q4 Launch — Weekly Sync",
    "transcript": "Maya: I'll send the timeline…",
    "participants": ["Maya Chen", "Priya Shah"],
    "route": ["notion", "jira"]
  }
}
```

The response should return the extraction result plus a `review_url`; routing happens only after approval unless the workspace enables auto-route for high-confidence items.

## Design notes

- Palette: forest `#143b2b`, lime `#d7f77d`, warm paper `#f2f1eb`, coral accent `#ef6a4d`.
- Typography: Avenir Next / system sans; monospace for IDs and the API snippet.
- Layout: 244px rail, 1320px content cap, 18–24px radii, compact 10–12px metadata for dashboard density.
- The signature dark "ready to review" card anchors the page; the lime is reserved for actions and success states.
