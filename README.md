# Hunter

Hunter is a personal-use Chrome extension + local helper service that turns any open job-listing
web page into a one-page, tailored resume — with zero input beyond a single button click. The
extension scrapes the current page and hands it to a locally-run pipeline; the pipeline uses a
local LLM (Claude Code CLI against an Ollama-served model) to rewrite the user's existing resume
to fit the listing, without inventing new facts. Output is a `.docx`, `.pdf`, and `.md` version of
the tailored resume, plus a saved copy of the job listing, in a timestamped folder.

This is a single-user, Windows-only, Chrome-only v0.1. No accounts, no multi-device sync, no cloud
LLM calls. See `docs/prd.md` for the full product spec.

## Technology stack

- **TypeScript** across every package.
- **`server/`** — Node/Express local helper server, run via Docker Compose, exposing the HTTP API
  the extension talks to.
- **`extension/`** — Chrome Manifest V3 extension. Plain TypeScript compiled to JS; no bundler yet
  (deferred until Phase 2, once there's real content-script logic to bundle).
- **`shared/`** — object shapes/types common to `server/` and `extension/`, so the HTTP contract
  between them is defined once and imported by both sides instead of hand-synced.
- **npm workspaces** ties the three packages together under a single root install/build/lint/test.
- **Biome** for linting and formatting, configured once at the repo root and extended by each
  workspace.
- **Mocha** (+ Node's built-in `assert`, TypeScript tests run via a `tsx` register) as the test
  runner, configured once at the repo root and extended by each workspace.

## Workspace layout

| Path         | What lives there                                                              |
|--------------|--------------------------------------------------------------------------------|
| `server/`    | The Node/TypeScript/Express local helper server (queue, pipeline orchestration, HTTP API). |
| `extension/` | The Chrome Manifest V3 extension (popup, scraping, notifications).            |
| `shared/`    | TypeScript types/contracts shared between `server/` and `extension/`. Consumed as source directly — no build step of its own. |
| `docs/`      | Project documentation — see below.                                            |

## Getting started

This repo is an npm workspaces project, so a single command at the root installs every workspace:

```sh
npm install
```

From the root:

```sh
npm run build   # compiles server/ and extension/ (shared/ is consumed as TS source, no build step)
npm run lint    # delegates to each workspace's own Biome-backed lint script
npm run test    # delegates to each workspace's own Mocha-backed test script
```

Detailed per-package instructions (loading the unpacked extension in Chrome, starting the server
locally, etc.) will be added once those workflows solidify in later phases; see `docs/roadmap.md`
Phase 11 for the eventual setup doc.

The Node version this repo is built against is pinned in `.nvmrc` (and mirrored in the root
`package.json` `engines` field) for reproducibility across contributors' machines.

## Documentation

Shared project documentation lives under `docs/`:

- `docs/prd.md` — the product requirements doc: goals, architecture, functional requirements, and
  the full user flow.
- `docs/roadmap.md` — the phased build plan this codebase is implemented against.
- `docs/open-questions.md` / `docs/prd-questions.md` — open-question tracking and the Q&A history
  behind decisions baked into the PRD.
- `docs/tickets/` — per-phase implementation tickets, one file per unit of work, each with its own
  goal, description, acceptance criteria, and (once implemented) a completion log.
