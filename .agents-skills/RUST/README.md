# Rust AI Agent Skills

Reusable `SKILL.md` modules for AI coding agents working on production Rust projects.

## Skill map

- `rust-core` — idiomatic Rust, ownership, borrowing, types
- `rust-error-handling` — typed errors, context, retries
- `rust-async-tokio` — Tokio concurrency, cancellation, timeouts
- `rust-agent-architecture` — model/tool/state orchestration
- `rust-testing` — unit, integration, async and agent evaluation
- `rust-performance` — measurement-driven optimization
- `rust-security` — trust boundaries, authorization, prompt injection
- `rust-api-web` — Axum-style HTTP services
- `rust-database` — Postgres/SQLx, transactions, persistence
- `rust-observability` — tracing, metrics, agent telemetry
- `rust-code-review` — senior-level review rubric
- `rust-project-conventions` — Cargo, CI, linting, project structure

## Suggested loading policy

Always load:
- `rust-core`
- `rust-error-handling`
- `rust-security`

Load based on task:
- HTTP service → `rust-api-web`
- async/concurrency → `rust-async-tokio`
- AI agent → `rust-agent-architecture`
- database → `rust-database`
- tests → `rust-testing`
- optimization → `rust-performance`
- production debugging → `rust-observability`
- review → `rust-code-review`

## Agent instruction

Treat these skills as engineering constraints, not as a substitute for project-specific requirements. Existing repository conventions and explicit user requirements take precedence when they do not violate safety or correctness.
