const MODEL = "qwen3.5:4b";

const endpoint = process.env.HUNTER_OLLAMA_ENDPOINT;

if (!endpoint) {
  console.error("HUNTER_OLLAMA_ENDPOINT is not set.");
  process.exit(1);
}

const url = `${endpoint.replace(/\/$/, "")}/v1/chat/completions`;

async function main(): Promise<void> {
  console.log(`Sending smoke-test prompt to ${url} (model: ${MODEL})...`);

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: MODEL,
      messages: [{ role: "user", content: "Reply with exactly one word: pong" }],
    }),
    signal: AbortSignal.timeout(30_000),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Ollama responded with ${response.status} ${response.statusText}: ${body}`);
  }

  const data = await response.json();
  const content = data?.choices?.[0]?.message?.content;

  console.log("Smoke test succeeded. Response:");
  console.log(content ?? JSON.stringify(data, null, 2));
}

main().catch((error) => {
  console.error("Smoke test failed:", error instanceof Error ? error.message : error);
  process.exit(1);
});
