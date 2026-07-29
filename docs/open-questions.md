# Project "Hunter" — Open Questions

Raised while drafting `roadmap.md` from `prd.md`. Answering these unblocks precise ticket-writing for the phases noted in each item. Fill in the **Answer:** line under each question (or replace it with a decision + rationale).

---

### OQ1 — Claude Code CLI ↔ Ollama compatibility
The PRD (§4, item 3) states Claude Code CLI is "configured to use a locally-served model via Ollama's OpenAI-compatible endpoint." Claude Code CLI is an Anthropic product; its support for pointing at a third-party OpenAI-compatible endpoint instead of Anthropic's API isn't established in the PRD (e.g., via an env var override, a config flag, or a compatibility shim/proxy in front of Ollama). This is the highest-risk technical assumption in the whole architecture — if unsupported as described, most of Phase 4/5 needs a different design (e.g., calling Ollama directly instead of through Claude Code CLI, or adding a proxy layer).
**Affects:** Roadmap Phase 4 (all), Phase 5.
**Answer:** Already settled during PRD drafting (`prd-questions.md` Round 2, Q25). Option (a) is confirmed: the server shells out to the Claude Code CLI, configured against the local Ollama-served model via Ollama's OpenAI-compatible endpoint, and Claude Code drives file creation directly. The user states this command syntax "has been verified to work as intended." No proxy/shim is needed, and no design pivot to calling Ollama directly. Phase 4/5 tickets can be scoped and estimated as originally written — blocker lifted.

### OQ2 — Shared-secret generation & distribution
FR23 says the shared secret is "generated locally, bundled into the extension config." Not specified: how it's generated (a setup script, a manual UUID paste, a value baked into a `.env` the extension config also reads), where the extension's copy lives (a config file edited before "load unpacked," a build step), and whether/how it's rotated.
**Affects:** Roadmap 1.2, 2.3, 11.2.
**Answer:** Partially answered. `prd-questions.md` Round 3 (Q41) and Round 4 (Q50) confirm the *design direction* — locking the server down is worth doing as long as it's low-effort, and a locally-generated shared secret (vs. an `Origin`/extension-ID check) is "a perfectly acceptable solution." That settles the mechanism choice. Still unspecified: the exact generation step (setup script vs. manual value), where the extension reads its copy from, and rotation policy — none of these were asked or answered in the Q&A. Since manual setup is explicitly acceptable for v0.1 (Round 2, Q37), a reasonable default is: the server generates the secret on first boot and writes it to a local file, and the Phase 11 setup doc instructs the user to copy that value into the extension's options before loading it unpacked. Treating this as an implementation default (like OQ6) rather than a hard blocker — downgrading Roadmap 1.2/2.3/11.2 from blocked to "proceed with the default above unless the user objects."
**Follow-up Answer:** The default described here for a manual extension setup is is fine.

### OQ3 — Progress/queue-depth reporting transport
FR4 and FR5 require step-by-step progress and queue depth in the popup, but the PRD doesn't specify the transport: polling an endpoint (and at what interval), Server-Sent Events, or WebSocket. This affects both server (does it need a push mechanism?) and extension (polling loop vs. persistent connection) implementation.
**Affects:** Roadmap 1.4, 2.5, 2.6.
**Answer:** This can be done with polling on 30 second intervals.

### OQ4 — Popup state on reopen
If the user closes and reopens the popup while a run is in progress, does it reconnect and show current progress, or reset to idle? This implies a server-side "what's the current run's status" endpoint if reconnect is desired, which isn't explicitly listed in the Functional Requirements.
**Affects:** Roadmap 1.4.
**Answer:** It should reconnect and show current progress. A server status endpoint should be part of a functional requirement.

### OQ5 — Missing progress-step list ("§5.5")
FR4 references "the step list in §5.5," but the current PRD has no §5.5 — §5's steps are listed as items a–g under the numbered flow, not as a lettered subsection. The popup's step-by-step display can't be built without a canonical, finalized list of step labels shown to the user.
**Affects:** Roadmap 2.5.
**Answer:** Answered. `prd-questions.md` Round 2, Q36 proposed the exact user-facing step labels — "Parsing job listing" → "Tailoring content" → "Checking page length" → "Generating .docx/.pdf/.md" → "Done" — and the user confirmed "those steps are fine." Folded back into `prd.md` as a new "Popup Progress Steps" list under §5, and FR4 corrected to point there instead of the nonexistent "§5.5." Roadmap 2.5 can be scoped now.

### OQ6 — .docx read/write library choice
FR16 requires reading the source `.docx` for a style reference (fonts/headings/margins) and writing a new `.docx`. No library is named. Options include `docx` (write), `mammoth` (read/convert), or `pizzip` + `docxtemplater`. The choice affects how faithfully style can be derived and how much custom parsing is needed.
**Affects:** Roadmap 6.1, 6.2.
**Answer:** Answered — explicitly deferred. `prd-questions.md` Round 4, Q52 asked this exact question; the user's answer was "that can be deferred as an implementation detail. The decision doesn't have downstream impact on other deliverables." No further product input is needed; left to whoever builds Phase 6. Blocker lifted.

### OQ7 — Page size and margin definition
FR18 requires enforcing a one-page limit via actual rendered page count, but "one page" depends on page size (Letter vs. A4) and margins, which aren't specified. Needed for deterministic, testable page-count logic.
**Affects:** Roadmap 7.2.
**Answer:** It will be standard letter size (8.5×11) with .75 inch margins.

### OQ8 — Debug log format
FR22 requires a per-run debug log capturing "the LLM's reasoning/steps," written to the server root with no retention policy. Format (plain text vs. structured JSON), verbosity, and filename convention (e.g., tied to the run's timestamp) aren't specified.
**Affects:** Roadmap 8.1.
**Answer:** Partially answered. `prd-questions.md` Round 3, Q44 confirms *why* the log exists (understanding the LLM's reasoning, for debugging tailoring quality — already folded into FR22) and Round 4, Q51 confirms *where* it lives and its retention policy (server root, outside the timestamped output folders, manual cleanup only — already reflected in PRD FR22/§8). Still open: the actual format (plain text vs. structured JSON), verbosity level, and filename convention. Neither question was asked in the Q&A rounds, so this stays genuinely open pending a decision.
**Follow-up Answer:** Plain text logging is preferred over JSON logging for human readability.

### OQ9 — Chrome notification permission & OS-level behavior
FR6 requires a Chrome notification at the end of every run. The manifest will need the `notifications` permission (not explicitly listed among the extension's stated permissions in §4/§6, which only mention host permissions). Worth confirming this is expected and that no additional OS-level notification settings/behavior is in scope.
**Affects:** Roadmap 2.1, 2.7.
**Answer:** Resolved — this was never actually a product decision needing input, just a manifest detail implied by FR6/Q35 (Round 2: notification should fire via the `notifications` API, confirmed again in Round 5 Q53 to fire on both success and failure). Roadmap ticket 2.1 already lists the `notifications` permission alongside `<all_urls>`, so there's nothing left to unblock. No OS-level behavior beyond "fires a notification" is in scope (Round 5, Q55: clicking it is purely informational).

### OQ10 — Claude Code CLI hang/timeout handling
§7 lists "Claude Code CLI process crash" as a distinct failure type, but doesn't address a CLI process that hangs without crashing (e.g., Ollama stops responding mid-generation). Is a timeout required, and if so, what value, and does it map to the "Ollama not running / model not available" error or a new distinct one?
**Affects:** Roadmap 4.4.
**Answer:** Due to the hardware limitations, a long-running Ollama call is very likely. There should be no timeouts, but the popup can display a warning if the current job duration exceeds 10 minutes, prompting manual intervention.

### OQ11 — Development/testing without full hardware setup
Development and testing implicitly assume a Windows host with Ollama and the `qwen3.5:4b` model already available. Is there a need (or desire) for a mocked/stubbed LLM response mode to support earlier-phase development (e.g., Phases 1–3) before the full local model stack is being exercised on every iteration?
**Affects:** Roadmap Phase 0–3 (development workflow, not a functional requirement).
**Answer:** A stubbed mock Ollama call is a very suitable development scaffold for end-to-end testing before plugging the LLM calls into the application's logical flow.

---

*Once answered, fold decisions back into `prd.md` or a follow-up "PRD addendum" so `roadmap.md` tickets can be de-flagged.*
