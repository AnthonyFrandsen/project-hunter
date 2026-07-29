import type { PlaceholderContract } from "shared";

/**
 * Scaffolding placeholder only — the real popup/content-script/background
 * logic lands in Phase 2. This proves `extension/` compiles plain TS to JS
 * (no bundler yet) and consumes `shared/`'s TypeScript source directly.
 */
export const placeholder: PlaceholderContract = { ok: true };
