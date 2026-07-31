import { randomUUID } from "node:crypto";
import type { Config } from "./config";

export type RunStatus = "queued" | "running" | "done";

export interface Run {
  id: string;
  status: RunStatus;
  listingText: string;
}

/**
 * FIFO queue of runs (ticket 1.3). Exposes the minimal internal state ticket 1.4's status
 * endpoint reads: the run currently in progress (or, once it finishes, the most recently
 * finished run, retained rather than evicted) and the runs still waiting behind it.
 */
export interface RunQueue {
  /** Enqueues a run and returns immediately without waiting for it to process. */
  submit(listingText: string): { id: string; status: "queued" };
  /** The run currently `running`, or the most recently `done` run if none is in progress. */
  getCurrentRun(): Run | null;
  /** Runs still waiting to start, in FIFO order. */
  getQueuedRuns(): Run[];
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function createRunQueue(config: Pick<Config, "mockOllamaDelayMs">): RunQueue {
  const runs: Run[] = [];
  let current: Run | null = null;
  let processing = false;

  function processNext(): void {
    if (processing) {
      return;
    }
    const next = runs.find((run) => run.status === "queued");
    if (!next) {
      return;
    }

    processing = true;
    next.status = "running";
    current = next;

    sleep(config.mockOllamaDelayMs).then(() => {
      next.status = "done";
      processing = false;
      processNext();
    });
  }

  return {
    submit(listingText) {
      const run: Run = { id: randomUUID(), status: "queued", listingText };
      runs.push(run);
      processNext();
      return { id: run.id, status: "queued" };
    },
    getCurrentRun() {
      return current;
    },
    getQueuedRuns() {
      return runs.filter((run) => run.status === "queued");
    },
  };
}
