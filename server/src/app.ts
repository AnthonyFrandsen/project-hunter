import express from "express";
import type { Config } from "./config";

export function createApp(config: Pick<Config, "ollamaEndpoint">) {
  const app = express();

  app.get("/health", async (_req, res) => {
    try {
      const response = await fetch(config.ollamaEndpoint, { signal: AbortSignal.timeout(2000) });
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
