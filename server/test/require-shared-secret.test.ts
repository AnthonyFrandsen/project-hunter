import assert from "node:assert";
import express from "express";
import { attachCoreMiddleware, attachErrorHandler } from "../src/app";
import { requireSharedSecret, SHARED_SECRET_HEADER } from "../src/middleware/require-shared-secret";

const config = { ollamaEndpoint: "http://host.docker.internal:11434", sharedSecret: "test-secret" };

async function withServer(
  app: express.Express,
  fn: (baseUrl: string) => Promise<void>,
): Promise<void> {
  const server = app.listen(0);
  const address = server.address();
  if (address === null || typeof address === "string") {
    throw new Error("expected an AddressInfo from an ephemeral-port listener");
  }
  try {
    await fn(`http://127.0.0.1:${address.port}`);
  } finally {
    server.close();
  }
}

describe("requireSharedSecret", () => {
  it("accepts a request carrying the correct shared secret", async () => {
    const app = express();
    app.get("/protected", requireSharedSecret(config), (_req, res) => {
      res.json({ ok: true });
    });

    await withServer(app, async (baseUrl) => {
      const response = await fetch(`${baseUrl}/protected`, {
        headers: { [SHARED_SECRET_HEADER]: config.sharedSecret },
      });

      assert.strictEqual(response.status, 200);
    });
  });

  it("rejects a request with no token with 401", async () => {
    const app = express();
    app.get("/protected", requireSharedSecret(config), (_req, res) => {
      res.json({ ok: true });
    });

    await withServer(app, async (baseUrl) => {
      const response = await fetch(`${baseUrl}/protected`);
      const body = await response.json();

      assert.strictEqual(response.status, 401);
      assert.strictEqual(typeof body.error, "string");
    });
  });

  it("rejects a request with the wrong token with 401", async () => {
    const app = express();
    app.get("/protected", requireSharedSecret(config), (_req, res) => {
      res.json({ ok: true });
    });

    await withServer(app, async (baseUrl) => {
      const response = await fetch(`${baseUrl}/protected`, {
        headers: { [SHARED_SECRET_HEADER]: "wrong-secret" },
      });
      const body = await response.json();

      assert.strictEqual(response.status, 401);
      assert.strictEqual(typeof body.error, "string");
    });
  });

  it("rejects a token of different length than the secret without throwing", async () => {
    const app = express();
    app.get("/protected", requireSharedSecret(config), (_req, res) => {
      res.json({ ok: true });
    });

    await withServer(app, async (baseUrl) => {
      const response = await fetch(`${baseUrl}/protected`, {
        headers: { [SHARED_SECRET_HEADER]: "short" },
      });

      assert.strictEqual(response.status, 401);
    });
  });

  it("leaves /health unauthenticated while protecting routes mounted after it", async () => {
    const app = express();
    attachCoreMiddleware(app, config);
    attachErrorHandler(app);

    await withServer(app, async (baseUrl) => {
      const healthResponse = await fetch(`${baseUrl}/health`);
      assert.strictEqual(healthResponse.status, 200);
    });
  });
});
