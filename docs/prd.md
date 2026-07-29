# Project "Hunter" — PRD v1

## 1. Overview
Hunter is a personal-use Chrome extension + local helper service that turns any open job-listing web page into a one-page, tailored resume — with zero input beyond a single button click. The extension scrapes the current page, hands it to a locally-run pipeline, and the pipeline uses a local LLM (via Claude Code CLI against an Ollama-served model) to rewrite the user's existing resume to fit the listing, without inventing new facts. Output is a `.docx`, `.pdf`, and `.md` version of the tailored resume, plus a saved copy of the job listing, in a timestamped folder.

This is a single-user, Windows-only, Chrome-only v0.1. No accounts, no multi-device sync, no cloud LLM calls.

## 2. Goals
- One-click generation of a tailored, one-page resume from any job listing page.
- Zero fabrication: all content in the output must be traceable to the source resume.
- Fully local: no third-party API keys, no data leaving the machine.
- Usable while waiting: multiple listings can be queued without blocking browsing.

## 3. Non-Goals
- Cross-device or cross-machine support.
- Resume upload/management UI — the source resume path is fixed via server config.
- Multi-browser support (Firefox/Edge/Safari) — Chrome only.
- Cover letter generation (candidate fast-follow, not v0.1).
- Automated quality evaluation of tailoring output (qualitative/informal only for v1).

## 4. System Architecture

**Components:**
1. **Chrome Extension (Manifest V3)** — broad host permissions (`<all_urls>`); popup UI; scrapes page `<body>` innerText on button click; talks to the local server over HTTP.
2. **Local Helper Server** — Node/Express, TypeScript, run via Docker Compose on `http://localhost:10105`. Responsibilities:
   - Receives scraped job listing text from the extension.
   - Cleans/filters the raw text (whitespace collapsing, nav/footer/script noise stripping) via lightweight filtering prompts before it reaches the main tailoring prompt, to keep context lean for the small local model.
   - Maintains the run queue.
   - Exposes a run-status endpoint reporting the current run's progress step and queue depth, polled by the extension every 30 seconds; also used to reconnect the popup to an in-progress run if it's closed and reopened.
   - Spawns the Claude Code CLI process per run, pointed at the local Ollama model, with a working directory mounted via Docker volume. No timeout is enforced on this process (long runs are expected given hardware constraints); see FR25 for the popup's advisory warning.
   - Converts the generated `.docx` to `.pdf` using a lightweight pure-JS renderer (not LibreOffice) — some visual drift from the `.docx` is acceptable.
   - Renders to PDF and reads the actual page count to enforce the one-page rule (real measurement, not a heuristic).
   - Writes the debug log, manages output folders, fires browser-visible run results back to the extension.
   - Enforces the shared-secret auth check on incoming requests.
3. **Claude Code CLI + Ollama** — Claude Code CLI drives file I/O and content generation directly (reading the source resume, tailoring content, writing `.md`/`.docx`), configured to use a locally-served model via Ollama's OpenAI-compatible endpoint (model: `qwen3.5:4b`, confirmed real and already pulled on the host). Ollama itself runs natively on the Windows host (not containerized); the Docker Compose stack reaches it via `host.docker.internal`. Claude Code's process is confined to the mounted project working directory via Docker mounts — no broader filesystem or shell access is implied by `--dangerously-skip-permissions` in this context.

**Division of labor:** Express handles orchestration (receiving input, spawning Claude Code, running PDF conversion, queueing, progress/notification plumbing). Claude Code is responsible only for reading the source resume, tailoring content, and writing `.md`/`.docx` — it does not perform PDF conversion.

## 5. User Flow
1. User navigates to a job listing page in Chrome and confirms it's the listing they want.
2. User clicks the extension button.
3. Extension captures all `<body>` innerText at click time (after DOM settle) and POSTs it to the local server, along with the shared secret.
4. Server enqueues the run (if others are in progress/queued) and begins processing when its turn comes.
5. Pipeline steps (each reflected in popup progress + debug log):
   a. Parse/validate: LLM judges whether the captured text is actually a job listing. If not, the run fails with a specific error.
   b. Clean/filter listing text to reduce noise/context size.
   c. Tailor resume content against the source `.docx`, using rewording/rephrasing/reordering of existing facts only (no fabrication) — enforced via prompt instructions.
   d. Generate `.docx` and `.md` from tailored content, using the source resume's fonts/headings/margins as a derived style reference (not a literal in-place XML edit).
   e. Convert `.docx` → `.pdf` via lightweight renderer; render and check actual page count.
   f. If more than one page, loop back to re-tailor with trimming guidance (drop lowest-relevance content per LLM judgment), up to 3 attempts total.
   g. If still over one page after 3 attempts, fail the run with a specific error; leave any partial files in place.
6. On completion (success or failure), the server writes all artifacts to a timestamped output folder and fires a browser notification stating pass/fail. Clicking the notification does nothing further (informational only).
7. Popup reflects final state; user can click again on the same or a different listing at any time, which enqueues a fresh, independent run (no dedupe/overwrite).
8. Throughout an active run, the popup polls the server's run-status endpoint every 30 seconds for progress and queue depth. If the popup is closed and reopened while a run is in progress, it reconnects via this endpoint and shows the run's current progress rather than resetting to idle.
9. If a run's duration exceeds 10 minutes, the popup surfaces a non-blocking advisory warning prompting the user to consider manual intervention. No timeout is enforced by the pipeline itself — long runs are expected given local hardware constraints, and the run continues unless the user intervenes.

### Popup Progress Steps
The popup shows the active run's progress as one of the following discrete, user-facing steps:
1. Parsing job listing
2. Tailoring content
3. Checking page length
4. Generating .docx/.pdf/.md
5. Done

## 6. Functional Requirements

### Extension
- FR1: Single button in the popup is the only required input to start a run.
- FR2: Captures full `<body>` innerText of the active tab at click time, after the DOM has settled.
- FR3: Requests broad host permissions (`<all_urls>`) since target sites are arbitrary.
- FR4: Displays granular step-by-step progress in the popup for the active run (see "Popup Progress Steps" under §5), sourced by polling the server's run-status endpoint (FR26) every 30 seconds.
- FR5: Displays queue depth (count of runs pending ahead of the current one) alongside current-run progress, from the same 30-second status poll.
- FR6: Fires a Chrome notification at the end of every run (success or failure); notification is informational only (no click action).
- FR7: Displays distinct, specific error messages per failure type (see §7), not a single generic error.
- FR8: Detects and reports if the local server is unreachable, rather than failing silently.
- FR24: If the popup is closed and reopened while a run is in progress, it reconnects via the run-status endpoint (FR26) and displays that run's current progress rather than resetting to an idle state.
- FR25: Displays a non-blocking warning in the popup if the active run's duration exceeds 10 minutes, prompting the user to consider manual intervention. This is advisory only — no automatic timeout or cancellation occurs (see FR15).

### Server / Pipeline
- FR9: Runs as a Docker Compose stack, listening on `http://localhost:10105`.
- FR10: Reads the source resume from a `.docx` path configured via environment variable.
- FR11: Reads the fixed base output folder path via environment variable; creates a new timestamped subfolder per run.
- FR12: Maintains a FIFO queue of runs; a run in progress does not block the user from browsing or enqueueing additional runs.
- FR13: Applies filtering prompts to clean raw scraped text before the main tailoring prompt.
- FR14: Judges whether submitted text is a valid job listing before proceeding; errors out distinctly if not.
- FR15: Invokes Claude Code CLI (pointed at local Ollama `qwen3.5:4b`) to tailor resume content — rewording, rephrasing, and reordering existing resume content are allowed; no new skills/experience/roles/projects may be introduced. No timeout is enforced on this process, given expected long runtimes on constrained local hardware (see FR25 for the popup-side advisory warning).
- FR16: Claude Code writes `.md` and `.docx` outputs; the `.docx` is regenerated using the source resume's fonts/headings/margins as a derived style reference (bullets and headers only — no tables/columns in source template).
- FR17: Server converts `.docx` to `.pdf` via a lightweight JS renderer (formatting drift from `.docx` acceptable).
- FR18: Server renders the `.pdf` and reads actual page count, measured against a US Letter page (8.5in × 11in) with 0.75in margins, to check the one-page constraint.
- FR19: If content exceeds one page, re-runs the tailoring step with trimming guidance, up to a maximum of 3 total attempts; on exceeding this, fails the run distinctly and leaves partial files in place.
- FR20: Saves the original job listing text as `job-listing.md` in the same timestamped output folder as the resume artifacts.
- FR21: Output resume files (`.docx`, `.pdf`, `.md`) retain the same base filename as the source resume.
- FR22: Writes a per-run debug log capturing the LLM's reasoning/steps in plain text (not structured/JSON) for human readability, stored in the server's root directory (not inside the timestamped folders); no automated log retention/cleanup — accumulates until manually cleared.
- FR23: Rejects requests that don't include a valid shared secret token (generated locally, bundled into the extension config) — guards against other browser tabs/sites POSTing to the port.
- FR26: Exposes a run-status endpoint reporting the current run's progress step and queue depth. Polled by the extension every 30 seconds (FR4/FR5) and used to reconnect the popup to an in-progress run on reopen (FR24).

## 7. Error Handling (Distinct Failure Types)
Each of the following must surface as its own distinct, user-visible error message (in the popup and via the end-of-run notification), and must not delete any partially-written output files:
- Server unreachable (extension can't connect to `localhost:10105`).
- Submitted page content judged not to be a job listing.
- Source resume file missing or corrupt/unreadable.
- One-page retry loop exceeded (3 attempts).
- Claude Code CLI process crash.
- Ollama not running, or the configured model not available/pulled.

**Note on hangs vs. crashes:** a Claude Code CLI process that hangs without crashing (e.g., Ollama stops responding mid-generation) is not treated as a distinct failure type and has no enforced timeout — long runs are an expected consequence of local hardware constraints. The only user-facing mitigation is the popup's advisory warning once a run exceeds 10 minutes (FR25), which does not cancel the run or surface an error; recovery from a genuine hang requires manual intervention (e.g., restarting the server).

## 8. Data & File Layout
- Source resume path: configured via server environment variable, fixed `.docx` file, bullets/headers-only structure (no tables/columns).
- Output base folder: configured via server environment variable (e.g. `C:\Users\<you>\Documents\Hunter\`); each run creates a timestamped subfolder containing:
  - `<original-resume-basename>.docx`
  - `<original-resume-basename>.pdf`
  - `<original-resume-basename>.md`
  - `job-listing.md`
- Debug logs: one per run, written in plain text to the server's root directory (outside the timestamped folders), retained indefinitely pending manual cleanup.
- Page format for one-page enforcement: US Letter (8.5in × 11in), 0.75in margins.

## 9. Non-Functional Requirements
- **Security:** Server validates a locally-generated shared secret on every request; no other origin/auth checks required given personal, unpublished, localhost-only use.
- **Privacy:** No resume or job listing content is sent to any third-party/cloud service; all LLM inference happens via local Ollama.
- **Concurrency:** Multiple runs can be enqueued; the LLM call is the expected bottleneck. Users can continue browsing/queueing while runs process sequentially.
- **Progress reporting:** The extension polls the server's run-status endpoint every 30 seconds for progress and queue-depth updates, and to reconnect the popup to an in-progress run on reopen. No push/streaming transport (SSE/WebSocket) is used for v0.1.
- **Long-running jobs:** No timeout is enforced on the Claude Code CLI/Ollama pipeline process, since long runs are expected given local hardware constraints. The popup surfaces an advisory warning once a run exceeds 10 minutes but does not cancel it; recovery from a genuine hang requires manual intervention.
- **Platform:** Windows host only; Ollama runs natively on the host; the rest of the stack runs in Docker Compose reachable via `host.docker.internal`.
- **Distribution/Setup:** Manual setup is acceptable for v0.1 — no installer required (run Docker Compose, load the unpacked extension in Chrome).
- **Development/testing:** A stubbed/mocked Ollama response mode is an acceptable development scaffold for earlier-phase work (before the real Claude Code CLI + Ollama integration is wired in), to support end-to-end testing of the surrounding pipeline without depending on the full local model stack on every iteration.

## 10. Success Criteria
- Primary goal: a functional, end-to-end pipeline from "click button on a job listing" to "one-page tailored resume in three formats," with no fabricated content.
- Tailoring *quality* is a qualitative KPI for this version — judged informally by the user during real use, with future iteration informed by that experience rather than an automated eval suite.

## 11. Out of Scope for v0.1 (Candidate Future Work)
- Cover letter generation.
- Cross-device/cross-machine or non-Windows support.
- Multi-browser support beyond Chrome.
- Resume upload/version management UI.
- Automated fabrication-detection/validation step beyond prompt-level enforcement.
- Automated tailoring-quality evaluation.

## 12. Known Risks
- **Model capacity risk:** `qwen3.5:4b` is a small local model chosen due to hardware constraints; it may struggle with reliable one-page tailoring and strict no-fabrication adherence compared to larger models. Mitigated only by prompt engineering and the retry/trim loop in v0.1 — no automated fact-checking safety net.
- **PDF fidelity risk:** the lightweight PDF renderer may produce visual drift from the `.docx`'s exact appearance; accepted as a known tradeoff for lower implementation complexity.
- **Docx regeneration risk:** the `.docx` output is regenerated from a derived style reference rather than edited in place, so exact pixel-fidelity to the original template isn't guaranteed, though the source template is simple (headers/bullets only), which limits this risk.
- **Hung-run risk:** no timeout is enforced on the Claude Code CLI/Ollama process (by design — see §9), so a genuine hang (e.g., Ollama becomes unresponsive) blocks that queue slot indefinitely beyond the popup's 10-minute advisory warning. Recovery requires manual intervention (e.g., restarting the server/container); there is no automatic detection or recovery in v0.1.
