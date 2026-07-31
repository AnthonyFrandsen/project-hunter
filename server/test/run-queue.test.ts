import assert from "node:assert";
import { createRunQueue } from "../src/run-queue";

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

describe("createRunQueue", () => {
  it("enqueues a run immediately with a generated id and queued status", () => {
    const runQueue = createRunQueue({ mockOllamaDelayMs: 1000 });

    const result = runQueue.submit("a listing");

    assert.strictEqual(result.status, "queued");
    assert.match(result.id, /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
  });

  it("gives each submission a unique id", () => {
    const runQueue = createRunQueue({ mockOllamaDelayMs: 1000 });

    const first = runQueue.submit("first");
    const second = runQueue.submit("second");

    assert.notStrictEqual(first.id, second.id);
  });

  it("retains the submitted listingText on the run record", () => {
    const runQueue = createRunQueue({ mockOllamaDelayMs: 1000 });

    const { id } = runQueue.submit("the listing text");

    const current = runQueue.getCurrentRun();
    assert.strictEqual(current?.id, id);
    assert.strictEqual(current?.listingText, "the listing text");
  });

  it("transitions a run queued -> running -> done via the configured delay", async () => {
    const DELAY = 30;
    const runQueue = createRunQueue({ mockOllamaDelayMs: DELAY });

    runQueue.submit("listing");
    // The queue is empty on submission, so processing starts synchronously.
    assert.strictEqual(runQueue.getCurrentRun()?.status, "running");

    await sleep(DELAY + DELAY / 2);

    assert.strictEqual(runQueue.getCurrentRun()?.status, "done");
  });

  it("submitting a new run while another is in progress returns immediately without blocking", () => {
    const runQueue = createRunQueue({ mockOllamaDelayMs: 1000 });

    const first = runQueue.submit("first");
    const start = performance.now();
    const second = runQueue.submit("second");
    const elapsed = performance.now() - start;

    assert.ok(elapsed < 50, `expected a non-blocking submission, took ${elapsed}ms`);
    assert.strictEqual(runQueue.getCurrentRun()?.id, first.id);
    assert.deepStrictEqual(
      runQueue.getQueuedRuns().map((run) => run.id),
      [second.id],
    );
  });

  it("processes runs strictly in FIFO submission order", async () => {
    const DELAY = 40;
    const runQueue = createRunQueue({ mockOllamaDelayMs: DELAY });

    const first = runQueue.submit("first");
    const second = runQueue.submit("second");
    const third = runQueue.submit("third");

    assert.strictEqual(runQueue.getCurrentRun()?.id, first.id);
    assert.deepStrictEqual(
      runQueue.getQueuedRuns().map((run) => run.id),
      [second.id, third.id],
    );

    await sleep(DELAY * 1.5);
    assert.strictEqual(runQueue.getCurrentRun()?.id, second.id);
    assert.strictEqual(runQueue.getCurrentRun()?.status, "running");
    assert.deepStrictEqual(
      runQueue.getQueuedRuns().map((run) => run.id),
      [third.id],
    );

    await sleep(DELAY);
    assert.strictEqual(runQueue.getCurrentRun()?.id, third.id);
    assert.strictEqual(runQueue.getCurrentRun()?.status, "running");
    assert.deepStrictEqual(runQueue.getQueuedRuns(), []);

    await sleep(DELAY * 1.5);
    assert.strictEqual(runQueue.getCurrentRun()?.id, third.id);
    assert.strictEqual(runQueue.getCurrentRun()?.status, "done");
  });

  it("retains the most recently finished run as current once the queue drains", async () => {
    const DELAY = 20;
    const runQueue = createRunQueue({ mockOllamaDelayMs: DELAY });

    const { id } = runQueue.submit("listing");
    await sleep(DELAY * 3);

    assert.strictEqual(runQueue.getCurrentRun()?.id, id);
    assert.strictEqual(runQueue.getCurrentRun()?.status, "done");
    assert.deepStrictEqual(runQueue.getQueuedRuns(), []);
  });
});
