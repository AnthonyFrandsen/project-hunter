import express, { type Express } from "express";
import type { Config } from "./config";
import { errorHandler } from "./middleware/error-handler";
import { createRouter } from "./routes";

export function attachCoreMiddleware(app: Express, config: Pick<Config, "ollamaEndpoint">): void {
  app.use(express.json());
  app.use(createRouter(config));
}

export function attachErrorHandler(app: Express): void {
  app.use(errorHandler);
}

export function createApp(config: Pick<Config, "ollamaEndpoint">): Express {
  const app = express();

  attachCoreMiddleware(app, config);
  attachErrorHandler(app);

  return app;
}
