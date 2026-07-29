/**
 * Placeholder for the HTTP contract shared between `server/` and `extension/`.
 * Real request/response/run-status shapes land in Phase 1 once the API is designed;
 * this stub only proves that `server/` and `extension/` can consume `shared/`'s
 * TypeScript source directly, with no build step of its own.
 */
export interface PlaceholderContract {
  readonly ok: true;
}
