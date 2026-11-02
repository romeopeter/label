---
name: rust-project-conventions
description: Establish consistent conventions for Rust projects, Cargo workspaces, modules, dependencies, formatting, linting, and CI.
---

# Rust Project Conventions

## Baseline
Use stable Rust unless the project explicitly requires nightly features.

Recommended baseline:
- `cargo fmt --check`
- `cargo clippy --all-targets --all-features -- -D warnings`
- `cargo test --all-features`
- `cargo check --all-targets --all-features`

## Cargo
- Keep dependency features minimal.
- Avoid duplicate crates serving the same purpose without a reason.
- Separate library code from binaries where reuse/testing benefits.
- Use workspaces for genuinely related crates.
- Keep crate responsibilities narrow.

## Modules
Prefer domain-oriented modules over giant `utils` modules.

Bad:
```text
utils.rs
helpers.rs
misc.rs
```

Better:
```text
domain/
billing/
auth/
agents/
infrastructure/
```

## Documentation
Document public APIs and non-obvious invariants. Do not write comments that merely restate the code.

## CI
CI should catch:
- formatting errors,
- clippy regressions,
- compile failures,
- test failures,
- dependency/security policy violations where applicable.

## Dependency discipline
Before adding a crate, ask:
1. Does the standard library already solve this?
2. Is the dependency maintained?
3. What is its compile-time/runtime cost?
4. Does it materially reduce complexity?
