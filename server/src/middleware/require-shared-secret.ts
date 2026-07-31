import { createHash, timingSafeEqual } from "node:crypto";
import type { RequestHandler } from "express";
import type { Config } from "../config";

/**
 * Header carrying the shared secret on protected requests. This is the source of truth for the
 * transport mechanism — ticket 2.3 (extension scrape/POST logic) must send the token this way.
 */
export const SHARED_SECRET_HEADER = "x-hunter-shared-secret";

function digest(value: string): Buffer {
  return createHash("sha256").update(value).digest();
}

/**
 * Rejects with 401 unless the request carries a token matching config.sharedSecret in the
 * SHARED_SECRET_HEADER header. Both sides are hashed to equal-length digests before
 * timingSafeEqual, since timingSafeEqual throws on a raw length mismatch and a length
 * pre-check would itself reintroduce a timing side-channel.
 */
export function requireSharedSecret(config: Pick<Config, "sharedSecret">): RequestHandler {
  const expected = digest(config.sharedSecret);

  return (req, res, next) => {
    const token = req.header(SHARED_SECRET_HEADER);
    if (!token || !timingSafeEqual(digest(token), expected)) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
    next();
  };
}
