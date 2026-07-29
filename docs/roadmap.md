# Project "Hunter" — Roadmap (v0.1)

Derived from `prd.md`. Organized into phases in rough dependency order. Each phase lists candidate tickets with suggested scope, and flags blockers where a ticket can't be scoped precisely until an item in `open-questions.md` is answered (marked **[BLOCKED: OQ#]**).

Phases are sequential in intent but Phase 2 (extension scaffold) can be built in parallel with Phases 3–6 (server pipeline) once Phase 1's HTTP contract is settled, since the two sides only need to agree on the API surface.

---

## Phase 0 — Environment & Repo Scaffolding
Goal: a running "hello world" Docker Compose stack that can reach host-side Ollama, before any product logic exists.

- **0.1** Repo structure: server package (Node/TS/Express), extension package, shared docs.
- **0.2** Docker Compose file + Dockerfile for the server; confirm `host.docker.internal` reaches native Windows Ollama from inside the container.
- **0.3** Base env-var config loading (source resume path, output base folder, shared secret, Ollama endpoint) per §8/§9.
- **0.4** Smoke test: container boots, hits Ollama's OpenAI-compatible endpoint with a trivial prompt, logs the response.
- **0.5** Stubbed/mocked Ollama response mode for use during Phases 1–3 development, so the pipeline's surrounding logic (queueing, progress, file I/O) can be built and tested end-to-end before the real Claude Code CLI + Ollama integration (Phase 4) is wired in. Resolved (`open-questions.md` OQ11): the user confirmed this is a suitable scaffold.

## Phase 1 — Server Core: HTTP API, Auth, Queue
Goal: the server can receive a request, authenticate it, enqueue it, and report status — with no real pipeline logic yet (stub the run with a sleep).

- **1.1** Express app skeleton listening on `:10105` (FR9).
- **1.2** Shared-secret auth middleware rejecting requests without a valid token (FR23). Design and generation/distribution mechanics confirmed (`open-questions.md` OQ2, incl. follow-up answer): server generates the secret on first boot and writes it to a local file; Phase 11 setup doc has the user copy it into the extension's options before loading unpacked. No longer just a default — the user has explicitly confirmed this flow is fine.
- **1.3** FIFO run queue: enqueue, process sequentially, non-blocking accept of new runs while one is in progress (FR12).
- **1.4** Run-status endpoint (in-memory store + `GET` endpoint, FR26) reporting the active run's progress step and queue depth. Resolved (`open-questions.md` OQ3/OQ4): transport is polling (no SSE/WebSocket needed) at a 30-second interval; the same endpoint backs popup reconnect-on-reopen (FR24), so it must reflect current state, not just push deltas.
- **1.5** Per-run timestamped output folder creation (FR11).

## Phase 2 — Chrome Extension Scaffold
Goal: a loadable unpacked extension with the popup, scraping, and POST wired to the Phase 1 stub server.

- **2.1** Manifest V3 setup: `<all_urls>` host permissions, `notifications` permission, popup entry point (FR3).
- **2.2** Popup UI: single button, minimal state (idle/running/done/error) (FR1).
- **2.3** Content-script/scrape logic: capture `<body>` innerText after DOM settle, POST to server with shared secret (FR2, FR23).
- **2.4** Server-unreachable detection and distinct UI state (FR8).
- **2.5** Step-by-step progress rendering in popup, polling Phase 1.4's status endpoint every 30 seconds (FR4). Step list confirmed (`open-questions.md` OQ5, sourced from `prd-questions.md` Q36) and folded into `prd.md` §5: "Parsing job listing" → "Tailoring content" → "Checking page length" → "Generating .docx/.pdf/.md" → "Done".
- **2.6** Queue-depth display alongside current-run progress, from the same 30-second status poll (FR5).
- **2.7** End-of-run Chrome notification, informational only, no click action (FR6).
- **2.8** Distinct error messages per failure type in popup (FR7) — depends on Phase 9's finalized error taxonomy.
- **2.9** Popup reconnect-on-reopen: on open, query Phase 1.4's status endpoint and render current progress if a run is active, instead of defaulting to idle state (FR24). Resolved (`open-questions.md` OQ4).
- **2.10** Long-running-job advisory warning: if the active run's duration exceeds 10 minutes, show a non-blocking warning in the popup prompting manual intervention (FR25). No cancel/timeout action is triggered automatically. Resolved (`open-questions.md` OQ10).

## Phase 3 — Listing Ingestion & Cleaning
Goal: raw scraped text becomes a validated, cleaned job listing ready for tailoring.

- **3.1** Filtering/cleaning prompt(s): whitespace collapsing, nav/footer/script noise stripping (FR13).
- **3.2** Job-listing validation step: LLM judges whether text is actually a listing; distinct failure path if not (FR14, §7).
- **3.3** Persist cleaned listing as `job-listing.md` in the run's output folder (FR20).

## Phase 4 — Claude Code CLI + Ollama Integration
Goal: the server can reliably spawn Claude Code CLI against the local Ollama model and get structured results back.

- **4.1** Process-spawn wrapper: invoke Claude Code CLI pointed at Ollama's OpenAI-compatible endpoint (`qwen3.5:4b`), working directory mounted via Docker volume (§4 item 3). Compatibility confirmed (`open-questions.md` OQ1, sourced from `prd-questions.md` Q25): the user has personally verified this Claude Code CLI + Ollama command syntax works as intended. No proxy/shim layer needed; ticket can be estimated as scoped.
- **4.2** Source resume ingestion: read fixed `.docx` path from env var; distinct failure if missing/corrupt (FR10, §7).
- **4.3** CLI crash/non-zero-exit handling as a distinct error type (§7).
- **4.4** No server-side timeout/hang handling is implemented for the CLI process, resolved (`open-questions.md` OQ10): long runs are expected given hardware constraints, so the process runs unbounded. The only user-facing mitigation is the popup's 10-minute advisory warning (Phase 2.10 / FR25), which does not cancel the run. This ticket is now a documentation/no-op — confirm no timeout logic exists rather than adding any.
- **4.5** "Ollama not running / model not pulled" detection as a distinct pre-flight or run-time error (§7).

## Phase 5 — Tailoring & Content Generation
Goal: Claude Code CLI produces tailored resume content with no fabrication, honoring reorder/reword-only constraints.

- **5.1** Tailoring prompt: reword/rephrase/reorder only, no new facts, enforced via prompt instructions (FR15).
- **5.2** Trim-and-retry prompt variant: re-tailor with guidance to drop lowest-relevance content (FR19, §5f).
- **5.3** Output: `.md` tailored resume written by Claude Code CLI (FR16).

## Phase 6 — Document Generation (.docx) & Style Reference
Goal: tailored content becomes a styled `.docx` derived from the source resume's look.

- **6.1** Choose and integrate a docx read/write library for extracting style reference (fonts/headings/margins) from the source `.docx`. Library choice explicitly deferred to implementation (`open-questions.md` OQ6, per `prd-questions.md` Q52 — "doesn't have downstream impact on other deliverables"); pick during this ticket, no further product sign-off needed.
- **6.2** Generate output `.docx` using derived style reference, bullets/headers only (FR16, §8).
- **6.3** Output filename matches source resume base filename across `.docx`/`.pdf`/`.md` (FR21).

## Phase 7 — PDF Conversion & One-Page Enforcement
Goal: `.docx` → `.pdf` with real page-count measurement and the retry/trim loop wired end-to-end.

- **7.1** Integrate lightweight pure-JS `.docx` → `.pdf` renderer (FR17).
- **7.2** Page-count measurement from rendered PDF, no heuristics (FR18), against a US Letter page (8.5in × 11in) with 0.75in margins. Resolved (`open-questions.md` OQ7).
- **7.3** Retry loop: on >1 page, loop back to Phase 5.2's trim-and-retry, up to 3 total attempts (FR19, §5f).
- **7.4** Exceeded-retries failure path: distinct error, partial files left in place, no cleanup (FR19, §7).

## Phase 8 — Logging & Output Assembly
Goal: every run leaves a complete, correctly-located artifact set and a debug trail.

- **8.1** Debug log writer capturing LLM reasoning/steps, written in plain text (not JSON) to server root (not timestamped folder), no retention policy (FR22). Resolved (`open-questions.md` OQ8 follow-up): plain text confirmed over structured JSON for human readability; verbosity level and filename convention remain implementation details for the builder.
- **8.2** Final artifact assembly check: confirm `.docx`, `.pdf`, `.md`, `job-listing.md` all present in the timestamped folder before marking run complete (§8).

## Phase 9 — Error Handling Pass
Goal: every failure type in §7 is independently triggerable, distinctly surfaced, and non-destructive.

- **9.1** Consolidate the six §7 failure types into a shared error taxonomy/enum used by both server responses and popup display.
- **9.2** Verify each failure type preserves partial output files (no deletion) per §7.
- **9.3** Wire taxonomy into extension's FR7 distinct-message display (closes out Phase 2.8).

## Phase 10 — Integration Testing & Informal Quality Pass
Goal: full click-to-output flow validated end-to-end on real job listings; tailoring quality judged qualitatively per §10.

- **10.1** End-to-end run against several real job listing pages of varying structure/noise.
- **10.2** Multi-run queueing test: verify FIFO ordering, non-blocking browsing, queue-depth display accuracy.
- **10.3** Deliberate failure-injection pass: stop Ollama, corrupt source resume, feed non-listing text — confirm each maps to its distinct error (§7).
- **10.4** Informal tailoring-quality review against real resume/listing pairs (§10) — no automated eval per Non-Goals.

## Phase 11 — Setup Documentation
Goal: a new environment can be brought up from scratch using only the docs.

- **11.1** Setup doc: Docker Compose bring-up, env var configuration, loading the unpacked extension (§9 Distribution/Setup).
- **11.2** Shared-secret setup steps documented: server generates the secret on first boot and writes it to a local file; docs walk the user through copying it into the extension's options before loading unpacked. Flow confirmed acceptable by the user (`open-questions.md` OQ2 follow-up answer) — no longer pending confirmation.

---

## Cross-Cutting Blockers Summary

Updated after cross-referencing `open-questions.md` against the original PRD Q&A (`prd-questions.md`) — several open questions turned out to already be answered there and just hadn't been folded back in. Resolved items are kept below (struck through) for traceability; only genuinely open items still gate ticket scoping.

| Open Question | Phases Affected | Status |
|---|---|---|
| ~~OQ1 — Claude Code CLI ↔ Ollama compatibility~~ | 4 (all), 5 | **Resolved** — confirmed working by the user (`prd-questions.md` Q25) |
| ~~OQ2 — Shared secret generation/distribution~~ | 1.2, 2.3, 11.2 | **Resolved** — approach and the proposed default flow (secret generated on first boot, written to a local file, manually copied into extension options) both explicitly confirmed by the user (OQ2 + follow-up answer) |
| ~~OQ3/OQ4 — Progress/queue transport & popup reconnect behavior~~ | 1.4, 2.5, 2.6, 2.9 | **Resolved** — transport is polling at a 30-second interval (OQ3); popup reconnects via a server status endpoint and shows current progress rather than resetting to idle (OQ4), which is now a formal FR (FR24/FR26) |
| ~~OQ5 — Missing progress-step list ("§5.5")~~ | 2.5 | **Resolved** — step list confirmed (`prd-questions.md` Q36), folded into `prd.md` §5 |
| ~~OQ6 — docx library choice~~ | 6.1, 6.2 | **Resolved** — explicitly deferred to implementation (`prd-questions.md` Q52) |
| ~~OQ7 — Page size/margin definition~~ | 7.2 | **Resolved** — US Letter (8.5in × 11in), 0.75in margins |
| ~~OQ8 — Debug log format~~ | 8.1 | **Resolved** — plain text confirmed over structured JSON (location/retention were already settled; verbosity/filename convention remain implementation details) |
| ~~OQ10 — CLI hang/timeout handling~~ | 4.4, 2.10 | **Resolved** — no timeout is enforced (long runs expected given hardware constraints); popup shows a 10-minute advisory warning only, now a formal FR (FR25) |

Also tracked in `open-questions.md`: OQ9 (notification permission — resolved, was already correctly listed in ticket 2.1) and OQ11 (mocked LLM for early-phase dev — resolved, confirmed as a suitable scaffold; addressed by new ticket 0.5).

See `open-questions.md` for full context on each item.
