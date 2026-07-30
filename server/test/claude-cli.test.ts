import assert from "node:assert";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createClaudeCliClient } from "../src/claude-cli";
import { STUB_NOT_A_LISTING_MARKER } from "../src/claude-cli-stub";

describe("claude-cli", () => {
  describe("createClaudeCliClient({ mockOllama: false })", () => {
    it("rejects, since the real Phase 4 CLI invocation isn't implemented yet", async () => {
      const client = createClaudeCliClient({ mockOllama: false, mockOllamaDelayMs: 0 });

      await assert.rejects(
        () => client.invoke({ stage: "validate-and-clean-listing", listingText: "anything" }),
        /Phase 4/,
      );
    });
  });

  describe("createClaudeCliClient({ mockOllama: true }) — validate-and-clean-listing", () => {
    it("judges plausible listing text as valid and returns whitespace-collapsed cleaned text", async () => {
      const client = createClaudeCliClient({ mockOllama: true, mockOllamaDelayMs: 0 });

      const result = await client.invoke({
        stage: "validate-and-clean-listing",
        listingText: "  Senior Engineer\n\n  Acme Corp   is hiring...  ",
      });

      assert.strictEqual(result.stage, "validate-and-clean-listing");
      if (result.stage !== "validate-and-clean-listing") throw new Error("unreachable");
      assert.strictEqual(result.isValidListing, true);
      assert.strictEqual(result.cleanedListingText, "Senior Engineer Acme Corp is hiring...");
    });

    it("judges empty text as not a valid listing, with null cleaned text", async () => {
      const client = createClaudeCliClient({ mockOllama: true, mockOllamaDelayMs: 0 });

      const result = await client.invoke({
        stage: "validate-and-clean-listing",
        listingText: "   ",
      });

      assert.strictEqual(result.stage, "validate-and-clean-listing");
      if (result.stage !== "validate-and-clean-listing") throw new Error("unreachable");
      assert.strictEqual(result.isValidListing, false);
      assert.strictEqual(result.cleanedListingText, null);
    });

    it("lets callers deliberately trigger the not-a-listing branch via a marker", async () => {
      const client = createClaudeCliClient({ mockOllama: true, mockOllamaDelayMs: 0 });

      const result = await client.invoke({
        stage: "validate-and-clean-listing",
        listingText: `some page text ${STUB_NOT_A_LISTING_MARKER} more text`,
      });

      assert.strictEqual(result.stage, "validate-and-clean-listing");
      if (result.stage !== "validate-and-clean-listing") throw new Error("unreachable");
      assert.strictEqual(result.isValidListing, false);
      assert.strictEqual(result.cleanedListingText, null);
    });
  });

  describe("createClaudeCliClient({ mockOllama: true }) — tailor-resume", () => {
    let outputDir: string;

    beforeEach(() => {
      outputDir = mkdtempSync(join(tmpdir(), "hunter-claude-cli-test-"));
    });

    afterEach(() => {
      rmSync(outputDir, { recursive: true, force: true });
    });

    it("writes a .md and .docx file to outputDir and returns their paths", async () => {
      const client = createClaudeCliClient({ mockOllama: true, mockOllamaDelayMs: 0 });

      const result = await client.invoke({
        stage: "tailor-resume",
        cleanedListingText: "Senior Engineer role at Acme Corp.",
        resumePath: "/fake/resume.docx",
        outputDir,
        resumeBaseName: "resume",
        attempt: 1,
      });

      assert.strictEqual(result.stage, "tailor-resume");
      if (result.stage !== "tailor-resume") throw new Error("unreachable");
      assert.strictEqual(result.markdownPath, join(outputDir, "resume.md"));
      assert.strictEqual(result.docxPath, join(outputDir, "resume.docx"));

      const markdown = readFileSync(result.markdownPath, "utf-8");
      assert.match(markdown, /Senior Engineer role at Acme Corp\./);
      assert.doesNotMatch(markdown, /Stub retry attempt/);

      const docx = readFileSync(result.docxPath, "utf-8");
      assert.match(docx, /Stubbed \.docx placeholder/);
    });

    it("includes trim-guidance context in the markdown on a retry attempt", async () => {
      const client = createClaudeCliClient({ mockOllama: true, mockOllamaDelayMs: 0 });

      const result = await client.invoke({
        stage: "tailor-resume",
        cleanedListingText: "Senior Engineer role at Acme Corp.",
        resumePath: "/fake/resume.docx",
        outputDir,
        resumeBaseName: "resume",
        attempt: 2,
        trimGuidance: "drop the earliest job",
      });

      if (result.stage !== "tailor-resume") throw new Error("unreachable");
      const markdown = readFileSync(result.markdownPath, "utf-8");
      assert.match(markdown, /Stub retry attempt 2/);
      assert.match(markdown, /drop the earliest job/);
    });
  });

  describe("configurable artificial delay", () => {
    it("resolves promptly when mockOllamaDelayMs is 0", async () => {
      const client = createClaudeCliClient({ mockOllama: true, mockOllamaDelayMs: 0 });

      const start = performance.now();
      await client.invoke({ stage: "validate-and-clean-listing", listingText: "some listing" });
      assert.ok(performance.now() - start < 50);
    });

    it("waits at least the configured delay before resolving", async () => {
      const client = createClaudeCliClient({ mockOllama: true, mockOllamaDelayMs: 50 });

      const start = performance.now();
      await client.invoke({ stage: "validate-and-clean-listing", listingText: "some listing" });
      assert.ok(performance.now() - start >= 50);
    });
  });
});
