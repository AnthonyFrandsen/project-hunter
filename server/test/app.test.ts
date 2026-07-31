import assert from "node:assert";
import express from "express";
import { attachCoreMiddleware, attachErrorHandler } from "../src/app";
import { SHARED_SECRET_HEADER } from "../src/middleware/require-shared-secret";

const config = { ollamaEndpoint: "http://host.docker.internal:11434", sharedSecret: "test-secret" };
const authHeaders = { [SHARED_SECRET_HEADER]: config.sharedSecret };

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

describe("app middleware", () => {
  it("parses JSON request bodies before they reach a route handler", async () => {
    const app = express();
    attachCoreMiddleware(app, config);
    app.post("/__test-echo", (req, res) => {
      res.json({ received: req.body });
    });
    attachErrorHandler(app);

    await withServer(app, async (baseUrl) => {
      const response = await fetch(`${baseUrl}/__test-echo`, {
        method: "POST",
        headers: { "content-type": "application/json", ...authHeaders },
        body: JSON.stringify({ hello: "world" }),
      });
      const body = await response.json();

      assert.strictEqual(response.status, 200);
      assert.deepStrictEqual(body.received, { hello: "world" });
    });
  });

  it("responds 500 without crashing when a route handler throws synchronously", async () => {
    const app = express();
    attachCoreMiddleware(app, config);
    app.get("/__test-throw", () => {
      throw new Error("boom");
    });
    attachErrorHandler(app);

    await withServer(app, async (baseUrl) => {
      const response = await fetch(`${baseUrl}/__test-throw`, { headers: authHeaders });
      const body = await response.json();

      assert.strictEqual(response.status, 500);
      assert.strictEqual(typeof body.error, "string");
    });
  });

  it("responds 500 without crashing when a route handler's promise rejects", async () => {
    const app = express();
    attachCoreMiddleware(app, config);
    app.get("/__test-reject", async () => {
      throw new Error("async boom");
    });
    attachErrorHandler(app);

    await withServer(app, async (baseUrl) => {
      const response = await fetch(`${baseUrl}/__test-reject`, { headers: authHeaders });
      const body = await response.json();

      assert.strictEqual(response.status, 500);
      assert.strictEqual(typeof body.error, "string");
    });
  });
});
