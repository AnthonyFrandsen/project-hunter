import { randomBytes } from "node:crypto";
import { existsSync, mkdirSync } from "node:fs";

export interface Config {
  resumePath: string;
  outputDir: string;
  ollamaEndpoint: string;
  sharedSecret: string;
  /**
   * Dev-only scaffold (ticket 0.5): when true, the Claude Code CLI invocation is stubbed out
   * (see claude-cli.ts) instead of shelling out to the real CLI. Never enable in a real run.
   */
  mockOllama: boolean;
  /** Artificial delay (ms) the stub sleeps before responding, to exercise progress/queue UI. */
  mockOllamaDelayMs: number;
}

export class ConfigError extends Error {}

function readResumePath(): string {
  const value = process.env.HUNTER_RESUME_PATH;
  if (!value) {
    throw new ConfigError("HUNTER_RESUME_PATH is not set.");
  }
  if (!value.toLowerCase().endsWith(".docx")) {
    throw new ConfigError(`HUNTER_RESUME_PATH must have a .docx extension, got: ${value}`);
  }
  if (!existsSync(value)) {
    throw new ConfigError(`HUNTER_RESUME_PATH does not exist: ${value}`);
  }
  return value;
}

function readOutputDir(): string {
  const value = process.env.HUNTER_OUTPUT_DIR;
  if (!value) {
    throw new ConfigError("HUNTER_OUTPUT_DIR is not set.");
  }
  try {
    mkdirSync(value, { recursive: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new ConfigError(`HUNTER_OUTPUT_DIR could not be created: ${value} (${message})`);
  }
  return value;
}

function readOllamaEndpoint(): string {
  const value = process.env.HUNTER_OLLAMA_ENDPOINT;
  if (!value) {
    throw new ConfigError("HUNTER_OLLAMA_ENDPOINT is not set.");
  }
  try {
    new URL(value);
  } catch {
    throw new ConfigError(`HUNTER_OLLAMA_ENDPOINT is not a well-formed URL: ${value}`);
  }
  return value;
}

function generateSharedSecret(): string {
  return randomBytes(32).toString("hex");
}

function readMockOllama(): boolean {
  const value = process.env.HUNTER_MOCK_OLLAMA;
  return value === "true" || value === "1";
}

function readMockOllamaDelayMs(): number {
  const value = process.env.HUNTER_MOCK_OLLAMA_DELAY_MS;
  if (!value) {
    return 0;
  }
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 0) {
    throw new ConfigError(
      `HUNTER_MOCK_OLLAMA_DELAY_MS must be a non-negative integer, got: ${value}`,
    );
  }
  return parsed;
}

export function loadConfig(): Config {
  const resumePath = readResumePath();
  const outputDir = readOutputDir();
  const ollamaEndpoint = readOllamaEndpoint();
  const sharedSecret = generateSharedSecret();
  const mockOllama = readMockOllama();
  const mockOllamaDelayMs = readMockOllamaDelayMs();
  return { resumePath, outputDir, ollamaEndpoint, sharedSecret, mockOllama, mockOllamaDelayMs };
}
