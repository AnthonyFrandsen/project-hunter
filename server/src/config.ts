import { randomBytes } from "node:crypto";
import { existsSync, mkdirSync } from "node:fs";

export interface Config {
  resumePath: string;
  outputDir: string;
  ollamaEndpoint: string;
  sharedSecret: string;
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

export function loadConfig(): Config {
  const resumePath = readResumePath();
  const outputDir = readOutputDir();
  const ollamaEndpoint = readOllamaEndpoint();
  const sharedSecret = generateSharedSecret();
  return { resumePath, outputDir, ollamaEndpoint, sharedSecret };
}
