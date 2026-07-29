import assert from "node:assert";
import type { PlaceholderContract } from "../src/index";

describe("shared", () => {
  it("wires up mocha + tsx for TypeScript tests", () => {
    const contract: PlaceholderContract = { ok: true };
    assert.strictEqual(contract.ok, true);
  });
});
