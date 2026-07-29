# Project "Hunter" — Open Questions for PRD

Answers to these will shape the PRD. Organized by topic; feel free to answer inline or point me to decisions already made.

## 1. Technical Architecture (Browser Extension Constraints)
1. Standard browser extensions (Manifest V3) cannot read/write arbitrary paths on the local filesystem — they're limited to the `downloads` API (save to Downloads, no arbitrary read) and sandboxed storage. Reading a resume from "a set path" and writing `.docx`/`.pdf` files back to a chosen folder will likely require either:
   - a **native messaging host** (a small local companion app/process the extension talks to), or
   - a **local helper server** (e.g., a background process on `localhost`) the extension calls via `fetch`.
   Is one of these acceptable, or is there a preferred approach? This affects install complexity (native host requires a separate installer/registration step).
   **Answer:** A local helper server aligns well with the other requirements of the project.
2. Which browser(s) must this support — Chrome only, or also Firefox/Edge/Safari? (Affects Manifest V3 API differences and native messaging setup per browser.)
   **Answer:** Only Google Chrome support is required.
3. Is "local machine" assumed to always be the same OS, or should it be cross-platform (Windows/macOS/Linux)?
   **Answer:** It will always be Windows.

## 2. LLM Integration
4. Which LLM provider/model should be used (e.g., Claude API, OpenAI, local model via Ollama)? Cloud API implies sending resume + job listing content to a third party — is that acceptable from a privacy standpoint, or is a local/offline model required?
   **Answer:** It should use Claude Code to support the file creation process with a locally-served LLM as the model using Ollama. I.e. `ollama launch claude --model qwen3.5:4b -- ${prompt} -p --dangerously-skip-permissions`
5. Who provides/pays for the API key — is this a bring-your-own-key setup, or bundled?
   **Answer:** No API key required.
6. Any budget/rate-limit constraints per run or per month?
   **Answer:** Nope. The v1 of this project is intended just for myself to use, so no limits should be necessary.

## 3. Job Listing Parsing
7. How should the extension "read" the job listing — scrape the visible DOM of the current tab, or target specific known job sites (LinkedIn, Indeed, Greenhouse, Lever, company career pages)? Generic scraping across arbitrary page layouts is much harder to make reliable than a handful of known-site parsers.
   **Answer:** I need it to scrape the DOM of the current page the user is viewing. Passing a collection of inner text to an AI agent to judge might be a possible path.
8. What happens if the user clicks the extension button on a page that isn't a job listing, or the content can't be reliably parsed? Silent failure, error message, best-effort attempt?
   **Answer:** If the AI parser determines the page content is not a job listing description, an error should be displayed to the user.

## 4. Resume Parsing & Fact Fidelity
9. The `.docx` source resume presumably has a specific structure (sections like Experience, Skills, Education). How rigid is that structure expected to be — is there a required template, or must parsing handle arbitrary resume layouts?
   **Answer:** The source resume is in a specific, set pattern.
10. "Does not fabricate" is a hard requirement — how should this be verified? Options: careful prompt engineering only, or an automated post-generation check that diffs claims in the output against the source resume before finalizing. Is some validation step in scope for MVP, or is prompt-level instruction sufficient?
   **Answer:** Prompt-level enforcement should be sufficient.
11. Is rewording/rephrasing existing bullet points allowed (e.g., emphasizing different aspects of a real project to match the listing's language), or should content be reused close to verbatim aside from selection/ordering?
   **Answer:** Rewording, rephrasing, and reordering are expected and intended to better suit my experiences to different roles.

## 5. One-Page Constraint
12. How should the one-page rule be enforced — dynamic font/margin shrinking, content-trimming rules (drop lowest-relevance bullets first), a hard content budget, or something else?
   **Answer:** Content trimming rules and AI-review loops should be used if the generated resume is too long.
13. What's the fallback if the tailored content genuinely can't fit even after trimming — truncate, warn the user, or let it overflow?
   **Answer:** There should be a maximum loop attempt that generates an error if exceeded.

## 6. Output Handling
14. Where do the three output files get saved — fixed folder, same folder as the source resume, or user-configurable?
   **Answer:** A timestamped directory should be created in a fixed folder location, so that the output files can retain the same name.
15. Naming convention for outputs (e.g., include company/role name, date, versioning to avoid overwriting previous runs)?
   **Answer:** See above; the goal is for the output file to match the filename of the input resume.
16. Should the `.docx`/`.pdf` preserve the visual formatting/template of the original resume, or is a standardized generated template acceptable?
   **Answer:** The formatting should be inherited from the original resume.
17. Is `.md` a real deliverable for the user, or just an intermediate/debug artifact in the pipeline?
   **Answer:** In addition to being a debugging tool, the `.md` deliverable exists in case the formatting of the `.pdf` and `.docx` isn't satisfactory but the text content should be preserved for future reference.
18. For "one button" — after clicking, is there any UI feedback (progress indicator, success/error notification, preview before files are written), or fully silent end-to-end?
   **Answer:** I would like a progress indicator that shows what step the backend is on.

## 7. Scope Boundaries
19. Is a cover letter explicitly out of scope for now, or a likely fast-follow?
   **Answer:** It can be considered a fast follow, but is not a required deliverable for v0.1
20. Is there any need to keep a history/log of past tailored resumes generated per job, or is each run independent/disposable?
   **Answer:** Good question. Preserving the job listing as a `.md` artifact alongside the generated resume documents should be added to the functional requirements.

## 8. Success Criteria
21. How will we know the tailoring quality is "good enough" — any evaluation approach (manual review, a test set of sample job listings), or judged informally by the user during use?
   **Answer:** This is a qualitative KPI that will need user surveying for future improvement possibilities. A functional pipeline from job listing to custom resume is the primary project goal.

## 9. Follow-up Questions (Round 2)

The Round 1 answers are all in, but a few raise new questions that need resolving before the PRD can be finalized.

### Local Helper Server
22. What should run the local helper server — a standalone script the user starts manually before use, or a background service/process that starts automatically (e.g., on Windows login)?
   **Answer:** A Docker Compose setup would satisfy this project's needs.
23. What language/framework should the server be built in (e.g., Python/FastAPI, Node/Express)? This affects which `.docx`/`.pdf` generation libraries are available.
   **Answer:** Node/Express, in TypeScript
24. What port/protocol should the extension use to reach the server (e.g., `http://localhost:PORT`), and should the extension detect/report if the server isn't running rather than failing silently?
   **Answer:** The server can serve from `http://localhost:10105`, and the extension should display an error message if it can't connect to that location.

### LLM / Claude Code + Ollama Integration
25. The example command `ollama launch claude --model qwen3.5:4b -- ${prompt} -p --dangerously-skip-permissions` mixes Ollama and the Claude Code CLI in a way that isn't a documented invocation — could you clarify the intended mechanism? Two plausible readings:
    a) The local helper server shells out to the **Claude Code CLI**, configured to point at a **local Ollama-served model** (via Ollama's OpenAI-compatible endpoint) as its backend, and lets Claude Code drive file creation directly in the output folder.
    b) The server calls the **Ollama API directly** (no Claude Code CLI involved), constructs prompts itself, and handles file writing in its own code.
   **Answer:** This command syntax has been verified to work as intended for the purposes of the project, described by option 'a' in your question.
26. `--dangerously-skip-permissions` disables Claude Code's tool-use confirmation prompts, letting it read/write files (and run shell commands, if enabled) autonomously. If option (a) above is the intent, should the PRD constrain what the LLM process can touch (e.g., restricted to a specific working directory, no shell/network tools), or is unrestricted access acceptable for a single-user local tool?
   **Answer:** We can confine it to the project's working directory using Docker mounts, which will be more than satisfactory for a local, single-user tool.
27. Is `qwen3.5:4b` a specific model you've already pulled and tested in Ollama, or a placeholder name? Worth confirming — a 4B-parameter model may struggle with reliable one-page tailoring and fabrication avoidance, which the PRD should flag as a quality risk either way.
   **Answer:** It is a risk, but I have extreme hardware limitations that prevent me from reasonably using larger models.

### Job Listing Parsing
28. How much of the page should be captured for the AI parser — full visible inner text, or a targeted subset (e.g., main content area only)? Some job sites are React/SPA-driven with lazy-loaded content — should the extension wait for the DOM to settle before capturing, or capture immediately on click?
   **Answer:** It should be any inner text inside the `<body>` tag, and it should capture it at the time the user clicks the extension (which should be after the DOM has settled.)

### Resume Source Structure
29. Can you describe (or share) the structure/template of the source `.docx` resume — section headers, and whether it uses simple paragraphs/bullets vs. tables/columns/text boxes? This determines whether formatting can be preserved via straightforward text substitution or needs a more involved template engine.
   **Answer:** The template uses headers and bullet points — no tables or columns.
30. Is the source resume file path fixed/hardcoded in config, or should it be a user-editable setting (e.g., in extension options), even though upload management itself is a non-goal?
   **Answer:** It should be configurable in the local helper server's environment config.

### One-Page Enforcement
31. What should drive "relevance" when trimming bullets to fit one page — the same LLM judging relevance against the job listing each loop iteration, or a simpler heuristic?
   **Answer:** The relevance will be determined by the LLM via a prompt that may have some guidelines or suggestions on how to prioritize aspects of the resume.
32. What's the max loop attempt count before giving up and erroring out (e.g., 3 tries)?
   **Answer:** 3 tries is fine.

### Output Handling
33. What is the fixed base folder path for timestamped output directories (e.g., `C:\Users\<you>\Documents\Hunter\`)?
   **Answer:** That path works, but it should be injected via environment variable on startup.
34. Should the job listing `.md` artifact use the same base filename as the resume outputs, or a distinct name (e.g., `job-listing.md`) within the same timestamped folder?
   **Answer:** It should use `job-listing.md`.

### UI / Progress Feedback
35. Should the progress indicator live in the extension popup only, or also surface a browser notification (via the `notifications` API) so you can navigate away mid-run?
   **Answer:** It should surface a browser notification when the output is finished, and have more granular visibility in the popup.
36. What are the discrete steps the progress indicator should show (e.g., "Parsing job listing" → "Tailoring content" → "Checking page length" → "Generating .docx/.pdf/.md" → "Done")?
   **Answer:** Those steps are fine.

### Setup / Distribution
37. Since this is v0.1 for personal use only, is a manual setup process (run a script, load the unpacked extension in Chrome) acceptable, or do you want a more polished installer experience?
   **Answer:** Manual is fine.

## 10. Follow-up Questions (Round 3)

Rounds 1 and 2 settled the overall architecture. These remaining questions are narrower — mostly about how the Docker/server side is built and a couple of robustness/security details worth deciding before the PRD is final.

### Docker / Server Environment
38. PDF generation from `.docx` typically needs a rendering engine — the standard approach in a Docker/Linux container is bundling LibreOffice headless (`soffice --convert-to pdf`) to convert the generated `.docx` into `.pdf`. This adds real size/complexity to the Docker image but preserves formatting fidelity closely. Is that an acceptable dependency, or is a lighter-weight pure-JS PDF renderer preferred (at the cost of the `.pdf` possibly drifting slightly from the `.docx`'s exact appearance)?
   **Answer:** A lighter weight solution is fine, even if the `.pdf` drifts slightly.
39. Where does Ollama itself run — inside the same Docker Compose stack (as its own service/container), or natively on the Windows host with the compose stack reaching it via `host.docker.internal`? This affects the compose file and whether the model needs pulling inside a container volume vs. already being present on the host.
   **Answer:** Ollama is available on the native Windows host.
40. Preserving the original resume's visual formatting — should the pipeline literally edit the source `.docx` in place (open it, replace/reorder the existing text runs while keeping its styles/XML), or regenerate a new `.docx` using the source's fonts/headings/margins as a style reference? The former is more likely to be pixel-faithful; the latter is more robust to unusual formatting but requires re-deriving a template.
   **Answer:** The template is not too advanced. It can be derived.

### Robustness & Security
41. Since the local server listens on an open port (`localhost:10105`), should it restrict which callers it accepts requests from (e.g., checking `Origin`/extension ID, or a shared local secret token) so an arbitrary website you happen to have open in another tab can't also POST to that port and trigger a run? Low severity for a personal tool, but cheap to close.
   **Answer:** We can lock it down, unless this adds substantial effort to the project.
42. The extension needs to read the full page body on whatever site you're viewing a job listing on, which means requesting broad host permissions (`<all_urls>`) rather than a fixed list of job-site domains. Is that acceptable, given this extension is unpublished and only loaded locally?
   **Answer:** Yes, this is acceptable. The intention is that the user clicks the button after they find a suitable job listing.
43. Beyond the three already-defined failure modes (not a job listing, server unreachable, exceeded one-page retry loop), should other pipeline failures — source resume file missing/corrupt, Claude Code CLI process crash, Ollama not running or model not pulled — surface as the same generic popup error, or would distinct messages per failure type help while debugging during this personal-use phase?
   **Answer:** Distinct error messages would be much more preferable.
44. Any preference for basic logging/observability on the server side (e.g., a log file written per run alongside the output artifacts) to help debug tailoring quality or pipeline failures during early use?
   **Answer:** A debug log would be helpful for understanding the LLM's reasoning. Let's include that in the functional requirements as well.

## 11. Follow-up Questions (Round 4)

Rounds 1–3 settled architecture, integration, and most robustness details. These last few affect how the pipeline is actually specified in the PRD and are worth pinning down before drafting.

### Server / LLM Process Division of Labor
45. Given Claude Code CLI (pointed at the local Ollama model) drives file creation directly, what is the Node/Express server's role versus Claude Code's role? Concretely: does Express only (a) receive the scraped job listing from the extension, (b) spawn the Claude Code CLI process with a constructed prompt against a mounted working directory, and (c) handle the `.docx`→`.pdf` conversion plus progress/notification plumbing itself — while Claude Code is solely responsible for reading the source resume, tailoring content, and writing the `.md`/`.docx` files? Or does Claude Code also run the PDF conversion step itself as one of its own tool calls?
   **Answer:** You had it right in the first part of your question. Claude Close does not handle the `.pdf` conversion.

### One-Page Enforcement Mechanism
46. With a lightweight (non-LibreOffice) PDF renderer chosen, how should "one page" actually be measured after each generation attempt — render to PDF and read the real page count from the output, or estimate via a character/line budget against the resume's known font size and margins before rendering? This determines whether the retry loop checks a real measurement or a heuristic proxy.
   **Answer:** Yes, it should render to a `pdf` and read the rendered page count.

### Job Listing Text Cleanup
47. Since the target model is a small 4B local model, should the server clean up the raw `<body>` innerText before sending it to Claude Code (e.g., collapsing whitespace, stripping obvious nav/footer/script noise), or should the full raw text pass through unmodified and rely on prompting alone? This matters for staying within the model's context window on long or noisy pages.
   **Answer:** Yes, there should be a few filtering prompts aiming at making the context lean for the next prompts.

### Model Confirmation
48. The example command references `qwen3.5:4b`, which doesn't match Ollama's published Qwen tag naming (e.g., `qwen2.5:3b/7b`, `qwen3:4b`). Can you confirm the exact model tag you've pulled and tested, so the PRD references a real identifier?
   **Answer:** Qwen 3.5 launched in February 2026. It is a real model, and is already available on the Windows host I'll be running this tool from.

### Concurrency
49. What should happen if the extension button is clicked again while a previous run is still in progress — ignore the second click, queue it to run after the first completes, or cancel the in-progress run and start over?
   **Answer:** A queue should be made; the bottleneck will be the LLM calls, but I would like to be able to browse other job listings while I wait for the tailored resumes to be generated.

### Localhost Security Mechanism
50. For locking down the server per Q41, a shared local secret (a static token generated on first run and baked into the extension's bundled config, sent as a header on each request) is the lowest-effort option that still blocks arbitrary other tabs from POSTing to the port. Is that acceptable, or would you prefer an `Origin`/extension-ID check instead?
   **Answer:** A locally generated shared secret is a perfectly acceptable solution.

### Debug Log
51. For the per-run debug log (Q44), should it live inside the same timestamped output folder as the resume/job-listing artifacts, and is there any retention/cleanup expectation, or should logs simply accumulate indefinitely?
   **Answer:** The logs should live in the root instead of the timestamped directories. Cleanup will be a manual task.

### Docx Template Derivation
52. For regenerating a new `.docx` styled after the source resume (Q40), do you have a preference for the Node library used to extract the source's fonts/headings/margins and produce the styled output (e.g., the `docx` npm package for generation plus a parser like `mammoth` or direct XML reading for extracting the source style), or is that an implementation detail you're comfortable leaving to the build phase?
   **Answer:** That can be deferred as an implementation detail. The decision doesn't have downstream impact on other deliverables.

## 12. Follow-up Questions (Round 5)

Rounds 1–4 settled architecture, integration, robustness, and pipeline division of labor — enough to draft most of the PRD. These last few are about notification/failure/queue *behavior*, which affects the UI-feedback and error-handling sections specifically.

### Notifications & Failure Feedback
53. Q35 established a browser notification fires when a run finishes successfully. Should a browser notification also fire when a run fails (any of the distinct error types from Q43), or should failures surface only in the popup, requiring the user to check back?
   **Answer:** Yes. It's more accurate to say that the browser notification fires at the end of every run and notifies the user of the result — pass or fail.
54. If a run fails partway through (one-page retry loop exceeded, source resume missing, Claude Code/Ollama crash, etc.), should any partially-written files in that run's timestamped output folder be deleted, or left in place (alongside the debug log) for troubleshooting?
   **Answer:** Leave them in place for troubleshooting.
55. Should clicking the success notification do anything (e.g., open the output folder), or is it purely informational?
   **Answer:** It is purely informational.

### Queue Visibility
56. With the run queue (Q49), should the popup show queue position/status for pending runs (e.g., "2 queued ahead of this one"), or only the currently-active run's step-by-step progress?
   **Answer:** It should show queue depth in addition to the status of the current job. 

### Re-runs
57. If the user clicks the extension button again on the same job listing page (e.g., to regenerate after being unsatisfied with the result), does that just enqueue a fresh run producing a second timestamped folder, or is any dedupe/overwrite behavior expected?
   **Answer:** It should trigger a fresh run.
