---
name: rust-error-handling
description: Design robust Rust error types and propagation for libraries, services, CLIs, and AI-agent systems.
---

# Rust Error Handling

## Objective
Make failures explicit, actionable, composable, and safe to expose.

## Rules
- Use `Result<T, E>` for recoverable failures.
- Use `thiserror` for typed application/library errors when dependency policy permits.
- Use `anyhow` at application boundaries when rich context matters more than programmatic matching.
- Preserve the original error as a source where useful.
- Add context at the layer that knows what operation failed.
- Never expose secrets, tokens, credentials, SQL, prompts containing private data, or internal stack details in user-facing errors.
- Distinguish domain errors from infrastructure errors.
- Do not turn every error into a string too early.
- Avoid error types with dozens of unrelated variants; split by responsibility.
- Model expected business outcomes separately from exceptional failures.
- Retry only errors that are demonstrably transient.

## Preferred pattern
Use typed errors inside reusable/domain code and translate them at application boundaries.

```rust
#[derive(Debug, thiserror::Error)]
pub enum UserError {
    #[error("user not found")]
    NotFound,
    #[error("invalid email")]
    InvalidEmail,
    #[error("database failure")]
    Database(#[from] sqlx::Error),
}
```

## Agent-specific rule
When an AI agent calls a tool, distinguish:
1. invalid tool input,
2. authorization failure,
3. transient infrastructure failure,
4. permanent tool failure,
5. successful tool execution with an unsuccessful business result.

The agent must not blindly retry category 1 or 4.
