import assert from "node:assert";
import { createApp } from "../src/app";

describe("server", () => {
  it("GET /health reports whether the native Ollama instance is reachable", async () => {
    const server = createApp().listen(0);
    const address = server.address();
    if (address === null || typeof address === "string") {
      throw new Error("expected an AddressInfo from an ephemeral-port listener");
    }

    try {
      const response = await fetch(`http://127.0.0.1:${address.port}/health`);
      const body = await response.json();

      assert.strictEqual(response.status, 200);
      assert.strictEqual(body.ok, true);
      assert.strictEqual(typeof body.ollamaReachable, "boolean");
    } finally {
      server.close();
    }
  });
});
