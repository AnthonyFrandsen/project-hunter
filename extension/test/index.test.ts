import assert from "node:assert";
import { placeholder } from "../src/background";

describe("extension", () => {
  it("wires up mocha + tsx for TypeScript tests", () => {
    assert.strictEqual(placeholder.ok, true);
  });
});
