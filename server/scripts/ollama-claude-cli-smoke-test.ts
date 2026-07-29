// Diagnostic only (Phase 0.4, reopened). Proves a Claude Code CLI invocation — the
// actual integration point per docs/prd.md §4 item 3 — can reach and use Ollama's
// `qwen3.5:4b` model from inside this container. Assumes the `claude` binary is
// already on PATH; this script does not install it (see ticket for why).
import { spawn } from "node:child_process";

const MODEL = "qwen3.5:4b";
// 5 minutes: a warm qwen3.5:4b response to this trivial prompt takes ~20s, but the
// first invocation after container start pays a one-time cold-load cost that can
// push well past 120s (observed during verification for this ticket).
const TIMEOUT_MS = 300_000;
const PROMPT = "Reply with exactly one word: pong";

const endpoint = process.env.HUNTER_OLLAMA_ENDPOINT;

if (!endpoint) {
  console.error("HUNTER_OLLAMA_ENDPOINT is not set.");
  process.exit(1);
}

const baseUrl = endpoint.replace(/\/$/, "");

console.log(`Invoking Claude Code CLI against ${baseUrl} (model: ${MODEL})...`);

const child = spawn("claude", ["-p", PROMPT, "--model", MODEL, "--dangerously-skip-permissions"], {
  env: {
    ...process.env,
    // Per docs.ollama.com/integrations/claude-code: Ollama speaks the Anthropic
    // Messages API directly at its root, so Claude Code is pointed at it like any
    // other Anthropic-compatible provider — no separate OpenAI-shim/proxy needed.
    ANTHROPIC_BASE_URL: baseUrl,
    ANTHROPIC_AUTH_TOKEN: "ollama",
    ANTHROPIC_API_KEY: "",
  },
  stdio: ["ignore", "pipe", "pipe"],
});

let stdout = "";
let stderr = "";
const timer = setTimeout(() => {
  console.error(`Smoke test timed out after ${TIMEOUT_MS}ms; killing CLI process.`);
  child.kill("SIGKILL");
}, TIMEOUT_MS);

child.stdout.on("data", (chunk: Buffer) => {
  stdout += chunk.toString();
});
child.stderr.on("data", (chunk: Buffer) => {
  stderr += chunk.toString();
});

child.on("error", (error) => {
  clearTimeout(timer);
  console.error(
    "Smoke test failed to launch the Claude Code CLI:",
    error instanceof Error ? error.message : error,
  );
  console.error(
    "Is the `claude` binary on PATH inside this container? See the ticket's " +
      "Implementation Log for how it was installed ad hoc for testing.",
  );
  process.exit(1);
});

child.on("close", (code) => {
  clearTimeout(timer);
  if (code === 0) {
    console.log("Smoke test succeeded. CLI output:");
    console.log(stdout.trim());
    process.exit(0);
  } else {
    console.error(`Smoke test failed. Claude Code CLI exited with code ${code}.`);
    if (stdout.trim()) console.error("stdout:\n" + stdout.trim());
    if (stderr.trim()) console.error("stderr:\n" + stderr.trim());
    process.exit(1);
  }
});
