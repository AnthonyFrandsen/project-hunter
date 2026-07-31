import { Router } from "express";
import type { Config } from "../config";
import { requireSharedSecret } from "../middleware/require-shared-secret";
import { createRunQueue } from "../run-queue";
import { healthRouter } from "./health";
import { runsRouter } from "./runs";

export function createRouter(
  config: Pick<Config, "ollamaEndpoint" | "sharedSecret" | "mockOllamaDelayMs">,
): Router {
  const router = Router();

  // /health (ticket 0.2) stays unauthenticated (OQ1.2-A) — mounted before the shared-secret
  // middleware below so it never reaches it.
  router.use(healthRouter(config));

  // Every route registered from here on requires the shared secret (OQ1.2 — ticket 1.2).
  router.use(requireSharedSecret(config));

  // One run queue per router instance, shared across POST /runs (ticket 1.3) and ticket 1.4's
  // future GET /runs/status so both read/write the same in-memory state.
  const runQueue = createRunQueue(config);
  router.use(runsRouter(runQueue));

  return router;
}
