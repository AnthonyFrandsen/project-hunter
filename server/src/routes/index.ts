import { Router } from "express";
import type { Config } from "../config";
import { requireSharedSecret } from "../middleware/require-shared-secret";
import { healthRouter } from "./health";

export function createRouter(config: Pick<Config, "ollamaEndpoint" | "sharedSecret">): Router {
  const router = Router();

  // /health (ticket 0.2) stays unauthenticated (OQ1.2-A) — mounted before the shared-secret
  // middleware below so it never reaches it.
  router.use(healthRouter(config));

  // Every route registered from here on requires the shared secret (OQ1.2 — ticket 1.2).
  // Tickets 1.3 (POST /runs) and 1.4 (GET /runs/status) mount onto `router` after this line.
  router.use(requireSharedSecret(config));

  return router;
}
