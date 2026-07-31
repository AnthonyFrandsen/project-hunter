import assert from "node:assert";
import express from "express";
import { attachCoreMiddleware, attachErrorHandler } from "../src/app";
import { SHARED_SECRET_HEADER } from "../src/middleware/require-shared-secret";

const config = {
  ollamaEndpoint: "http://host.docker.internal:11434",
  sharedSecret: "test-secret",
  mockOllamaDelayMs: 0,
};
const authHeaders = {
  "content-type": "application/json",
  [SHARED_SECRET_HEADER]: config.sharedSecret,
};

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

function buildApp(delayMs: number): express.Express {
  const app = express();
  attachCoreMiddleware(app, { ...config, mockOllamaDelayMs: delayMs });
  attachErrorHandler(app);
  return app;
}

describe("POST /runs", () => {
  it("rejects a request with no listingText with 400", async () => {
    await withServer(buildApp(0), async (baseUrl) => {
      const response = await fetch(`${baseUrl}/runs`, {
        method: "POST",
        headers: authHeaders,
        body: JSON.stringify({}),
      });
      const body = await response.json();

      assert.strictEqual(response.status, 400);
      assert.strictEqual(typeof body.error, "string");
    });
  });

  it("rejects a request with a non-string listingText with 400", async () => {
    await withServer(buildApp(0), async (baseUrl) => {
      const response = await fetch(`${baseUrl}/runs`, {
        method: "POST",
        headers: authHeaders,
        body: JSON.stringify({ listingText: 12345 }),
      });

      assert.strictEqual(response.status, 400);
    });
  });

  it("rejects a request with an empty listingText with 400", async () => {
    await withServer(buildApp(0), async (baseUrl) => {
      const response = await fetch(`${baseUrl}/runs`, {
        method: "POST",
        headers: authHeaders,
        body: JSON.stringify({ listingText: "" }),
      });

      assert.strictEqual(response.status, 400);
    });
  });

  it("accepts a valid submission and responds with an id and queued status", async () => {
    await withServer(buildApp(0), async (baseUrl) => {
      const response = await fetch(`${baseUrl}/runs`, {
        method: "POST",
        headers: authHeaders,
        body: JSON.stringify({ listingText: "Senior Engineer at Acme Corp" }),
      });
      const body = await response.json();

      assert.strictEqual(response.status, 201);
      assert.strictEqual(typeof body.id, "string");
      assert.strictEqual(body.status, "queued");
      assert.strictEqual(Object.keys(body).length, 2);
    });
  });

  it("requires the shared secret, consistent with every other route mounted after it", async () => {
    await withServer(buildApp(0), async (baseUrl) => {
      const response = await fetch(`${baseUrl}/runs`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ listingText: "some listing" }),
      });

      assert.strictEqual(response.status, 401);
    });
  });

  it("accepts a second submission immediately while the first is still processing", async () => {
    await withServer(buildApp(1000), async (baseUrl) => {
      const first = await fetch(`${baseUrl}/runs`, {
        method: "POST",
        headers: authHeaders,
        body: JSON.stringify({ listingText: "first listing" }),
      });
      assert.strictEqual(first.status, 201);

      const start = performance.now();
      const second = await fetch(`${baseUrl}/runs`, {
        method: "POST",
        headers: authHeaders,
        body: JSON.stringify({ listingText: "second listing" }),
      });
      const elapsed = performance.now() - start;
      const secondBody = await second.json();

      assert.strictEqual(second.status, 201);
      assert.ok(elapsed < 500, `expected a non-blocking submission, took ${elapsed}ms`);
      assert.strictEqual(secondBody.status, "queued");
    });
  });
});
