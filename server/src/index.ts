import { createApp } from "./app";
import { type Config, ConfigError, loadConfig } from "./config";

const PORT = 10105;

function loadConfigOrExit(): Config {
  try {
    return loadConfig();
  } catch (error) {
    console.error(error instanceof ConfigError ? error.message : error);
    process.exit(1);
  }
}

const config = loadConfigOrExit();

console.log(`Shared secret (paste into the extension's configuration): ${config.sharedSecret}`);

if (config.mockOllama) {
  console.warn(
    "HUNTER_MOCK_OLLAMA is enabled — Claude Code CLI invocations are stubbed (server/src/claude-cli-stub.ts), " +
      "not real. Dev-only scaffold; never enable this for a real run.",
  );
}

createApp(config).listen(PORT, () => {
  console.log(`server listening on :${PORT}`);
});
