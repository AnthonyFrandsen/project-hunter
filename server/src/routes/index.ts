import { Router } from "express";
import type { Config } from "../config";
import { healthRouter } from "./health";

export function createRouter(config: Pick<Config, "ollamaEndpoint">): Router {
  const router = Router();

  router.use(healthRouter(config));

  return router;
}
