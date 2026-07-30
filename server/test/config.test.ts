import assert from "node:assert";
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { ConfigError, loadConfig } from "../src/config";

const ENV_KEYS = [
  "HUNTER_RESUME_PATH",
  "HUNTER_OUTPUT_DIR",
  "HUNTER_OLLAMA_ENDPOINT",
  "HUNTER_MOCK_OLLAMA",
  "HUNTER_MOCK_OLLAMA_DELAY_MS",
] as const;

describe("config", () => {
  let tmpDir: string;
  let resumePath: string;
  let outputDir: string;
  const savedEnv: Record<string, string | undefined> = {};

  beforeEach(() => {
    for (const key of ENV_KEYS) {
      savedEnv[key] = process.env[key];
      delete process.env[key];
    }

    tmpDir = mkdtempSync(join(tmpdir(), "hunter-config-test-"));
    resumePath = join(tmpDir, "resume.docx");
    writeFileSync(resumePath, "");
    outputDir = join(tmpDir, "output");
  });

  afterEach(() => {
    for (const key of ENV_KEYS) {
      if (savedEnv[key] === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = savedEnv[key];
      }
    }
    rmSync(tmpDir, { recursive: true, force: true });
  });

  function setValidEnv() {
    process.env.HUNTER_RESUME_PATH = resumePath;
    process.env.HUNTER_OUTPUT_DIR = outputDir;
    process.env.HUNTER_OLLAMA_ENDPOINT = "http://host.docker.internal:11434";
  }

  it("loads all four values when the env vars are valid", () => {
    setValidEnv();

    const config = loadConfig();

    assert.strictEqual(config.resumePath, resumePath);
    assert.strictEqual(config.outputDir, outputDir);
    assert.strictEqual(config.ollamaEndpoint, "http://host.docker.internal:11434");
    assert.strictEqual(typeof config.sharedSecret, "string");
    assert.ok(config.sharedSecret.length > 0);
  });

  it("generates a fresh shared secret on every call, never persisting it", () => {
    setValidEnv();

    const first = loadConfig();
    const second = loadConfig();

    assert.notStrictEqual(first.sharedSecret, second.sharedSecret);
  });

  it("creates the output dir when it doesn't already exist", () => {
    setValidEnv();
    assert.strictEqual(existsSync(outputDir), false);

    loadConfig();

    assert.strictEqual(existsSync(outputDir), true);
  });

  it("succeeds when the output dir already exists", () => {
    setValidEnv();
    mkdirSync(outputDir);

    assert.doesNotThrow(() => loadConfig());
  });

  it("throws on a missing HUNTER_RESUME_PATH, checked before the other values", () => {
    process.env.HUNTER_OUTPUT_DIR = outputDir;
    process.env.HUNTER_OLLAMA_ENDPOINT = "not a url";

    assert.throws(
      () => loadConfig(),
      (error: unknown) => {
        return error instanceof ConfigError && /HUNTER_RESUME_PATH/.test(error.message);
      },
    );
  });

  it("throws when the resume path doesn't have a .docx extension", () => {
    const wrongExtension = join(tmpDir, "resume.pdf");
    writeFileSync(wrongExtension, "");
    process.env.HUNTER_RESUME_PATH = wrongExtension;
    process.env.HUNTER_OUTPUT_DIR = outputDir;
    process.env.HUNTER_OLLAMA_ENDPOINT = "http://host.docker.internal:11434";

    assert.throws(() => loadConfig(), ConfigError);
  });

  it("throws when the resume path doesn't exist on disk", () => {
    process.env.HUNTER_RESUME_PATH = join(tmpDir, "missing.docx");
    process.env.HUNTER_OUTPUT_DIR = outputDir;
    process.env.HUNTER_OLLAMA_ENDPOINT = "http://host.docker.internal:11434";

    assert.throws(() => loadConfig(), ConfigError);
  });

  it("throws on a missing HUNTER_OUTPUT_DIR", () => {
    process.env.HUNTER_RESUME_PATH = resumePath;
    process.env.HUNTER_OLLAMA_ENDPOINT = "http://host.docker.internal:11434";

    assert.throws(
      () => loadConfig(),
      (error: unknown) => {
        return error instanceof ConfigError && /HUNTER_OUTPUT_DIR/.test(error.message);
      },
    );
  });

  it("throws on a missing HUNTER_OLLAMA_ENDPOINT", () => {
    process.env.HUNTER_RESUME_PATH = resumePath;
    process.env.HUNTER_OUTPUT_DIR = outputDir;

    assert.throws(
      () => loadConfig(),
      (error: unknown) => {
        return error instanceof ConfigError && /HUNTER_OLLAMA_ENDPOINT/.test(error.message);
      },
    );
  });

  it("throws when HUNTER_OLLAMA_ENDPOINT is not a well-formed URL", () => {
    process.env.HUNTER_RESUME_PATH = resumePath;
    process.env.HUNTER_OUTPUT_DIR = outputDir;
    process.env.HUNTER_OLLAMA_ENDPOINT = "not a url";

    assert.throws(() => loadConfig(), ConfigError);
  });

  it("defaults mockOllama to false and mockOllamaDelayMs to 0 when unset", () => {
    setValidEnv();

    const config = loadConfig();

    assert.strictEqual(config.mockOllama, false);
    assert.strictEqual(config.mockOllamaDelayMs, 0);
  });

  it("enables mockOllama when HUNTER_MOCK_OLLAMA is 'true' or '1'", () => {
    setValidEnv();

    process.env.HUNTER_MOCK_OLLAMA = "true";
    assert.strictEqual(loadConfig().mockOllama, true);

    process.env.HUNTER_MOCK_OLLAMA = "1";
    assert.strictEqual(loadConfig().mockOllama, true);

    process.env.HUNTER_MOCK_OLLAMA = "nope";
    assert.strictEqual(loadConfig().mockOllama, false);
  });

  it("parses a valid HUNTER_MOCK_OLLAMA_DELAY_MS", () => {
    setValidEnv();
    process.env.HUNTER_MOCK_OLLAMA_DELAY_MS = "250";

    assert.strictEqual(loadConfig().mockOllamaDelayMs, 250);
  });

  it("throws on a non-integer or negative HUNTER_MOCK_OLLAMA_DELAY_MS", () => {
    setValidEnv();

    process.env.HUNTER_MOCK_OLLAMA_DELAY_MS = "-5";
    assert.throws(() => loadConfig(), ConfigError);

    process.env.HUNTER_MOCK_OLLAMA_DELAY_MS = "not-a-number";
    assert.throws(() => loadConfig(), ConfigError);
  });
});
