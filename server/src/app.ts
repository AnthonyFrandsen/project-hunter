import express from "express";

/**
 * Hardcoded per ticket 0.2 — ticket 0.3 owns replacing this with the config-driven
 * Ollama endpoint env var once its config loader lands.
 */
const OLLAMA_URL = "http://host.docker.internal:11434";

export function createApp() {
  const app = express();

  app.get("/health", async (_req, res) => {
    try {
      const response = await fetch(OLLAMA_URL, { signal: AbortSignal.timeout(2000) });
      res.json({ ok: true, ollamaReachable: response.ok, ollamaStatus: response.status });
    } catch (error) {
      res.json({
        ok: true,
        ollamaReachable: false,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  });

  return app;
}
