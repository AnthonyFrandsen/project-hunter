import { Router } from "express";
import type { RunQueue } from "../run-queue";

export function runsRouter(runQueue: RunQueue): Router {
  const router = Router();

  router.post("/runs", (req, res) => {
    const listingText = (req.body as { listingText?: unknown } | undefined)?.listingText;
    if (typeof listingText !== "string" || listingText.length === 0) {
      res.status(400).json({ error: "listingText is required and must be a non-empty string" });
      return;
    }

    res.status(201).json(runQueue.submit(listingText));
  });

  return router;
}
