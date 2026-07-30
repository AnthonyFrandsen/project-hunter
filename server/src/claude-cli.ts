import { createStubClaudeCliClient } from "./claude-cli-stub";
import type { Config } from "./config";

/**
 * This module is the seam Phase 4 (ticket 4.1) will fill with a real Claude Code CLI
 * process-spawn wrapper. Per docs/prd.md §4, the CLI — not this server — is the thing that
 * calls Ollama and drives `.md`/`.docx` file creation directly, so every stage input/result
 * shape here models "what a real CLI invocation would take/produce," not an Ollama HTTP call.
 */

export interface ValidateAndCleanListingInput {
  stage: "validate-and-clean-listing";
  /** Raw scraped page text (FR13/FR14). */
  listingText: string;
}

export interface ValidateAndCleanListingResult {
  stage: "validate-and-clean-listing";
  isValidListing: boolean;
  /** Null when isValidListing is false — the FR14 "not a valid listing" failure path. */
  cleanedListingText: string | null;
}

export interface TailorResumeInput {
  stage: "tailor-resume";
  cleanedListingText: string;
  resumePath: string;
  outputDir: string;
  /** Output files are named `${resumeBaseName}.md` / `.docx`, per FR21. */
  resumeBaseName: string;
  /** 1-based attempt number within FR19's up-to-3-attempts trim/retry loop. */
  attempt: number;
  /** Trimming guidance for attempt > 1 (FR19/§5f) — omitted on the first attempt. */
  trimGuidance?: string;
}

export interface TailorResumeResult {
  stage: "tailor-resume";
  markdownPath: string;
  docxPath: string;
}

export type ClaudeCliInput = ValidateAndCleanListingInput | TailorResumeInput;
export type ClaudeCliResult = ValidateAndCleanListingResult | TailorResumeResult;

export interface ClaudeCliClient {
  invoke(input: ClaudeCliInput): Promise<ClaudeCliResult>;
}

export function createClaudeCliClient(
  config: Pick<Config, "mockOllama" | "mockOllamaDelayMs">,
): ClaudeCliClient {
  if (config.mockOllama) {
    return createStubClaudeCliClient(config.mockOllamaDelayMs);
  }

  return {
    invoke() {
      return Promise.reject(
        new Error(
          "Real Claude Code CLI invocation is not implemented yet (Phase 4). " +
            "Set HUNTER_MOCK_OLLAMA=true to use the dev stub in the meantime.",
        ),
      );
    },
  };
}
