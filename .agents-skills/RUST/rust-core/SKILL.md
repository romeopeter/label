---
name: rust-core
description: Write idiomatic, maintainable Rust using ownership, borrowing, traits, enums, generics, iterators, and modern Rust conventions.
---

# Rust Core Engineering

## Objective
Produce idiomatic Rust that is explicit about ownership, safe by default, easy to test, and unsurprising to experienced Rust engineers.

## Rules
- Prefer ownership and borrowing over unnecessary cloning.
- Treat `clone()` as a deliberate tradeoff; explain it when it is non-trivial.
- Prefer `&str` over `String` for borrowed string inputs and `&[T]` over `Vec<T>` when ownership is not required.
- Prefer enums and exhaustive `match` for finite states and domain variants.
- Prefer `Option<T>` and `Result<T, E>` over sentinel values, null-like conventions, or panic-driven control flow.
- Use `?` for error propagation.
- Prefer iterators when they improve clarity; use explicit loops when they make control flow clearer.
- Use `impl Trait` where it improves API ergonomics, but do not hide important types unnecessarily.
- Prefer newtypes for domain identifiers and values where type confusion is plausible.
- Keep public APIs intentionally small.
- Avoid `pub` by default.
- Prefer composition over inheritance-like patterns.
- Use `Default` only when a meaningful default exists.
- Avoid `unwrap()` and `expect()` in production paths unless the invariant is genuinely impossible to violate; document such invariants.
- Do not use `unsafe` unless there is a measurable need and the safety invariant can be documented and reviewed.
- Keep functions focused and avoid clever abstractions that obscure ownership or control flow.

## Review checklist
- Can ownership be simplified?
- Is a clone actually necessary?
- Are domain states represented by types?
- Are errors propagated rather than swallowed?
- Is the public API smaller than the implementation?
- Would another Rust engineer understand the lifetime/ownership story immediately?
