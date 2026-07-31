import { Router } from "express";
import type { Config } from "../config";

export function healthRouter(config: Pick<Config, "ollamaEndpoint">): Router {
  const router = Router();

  router.get("/health", async (_req, res) => {
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

  return router;
}
