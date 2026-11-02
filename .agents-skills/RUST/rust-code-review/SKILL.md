---
name: rust-code-review
description: Perform senior-level Rust code reviews focused on correctness, ownership, concurrency, API design, security, performance, and maintainability.
---

# Senior Rust Code Review

Review in this order:

## 1. Correctness
- Does the implementation actually satisfy the requirement?
- Are edge cases handled?
- Are state transitions valid?
- Can errors be silently ignored?

## 2. Ownership and lifetimes
- Are clones necessary?
- Are references valid and understandable?
- Is shared ownership justified?
- Is interior mutability hiding architectural problems?

## 3. Concurrency
- Can tasks leak?
- Can work become unbounded?
- Are locks held across `.await`?
- Is cancellation handled?
- Can races corrupt domain state?

## 4. Error handling
- Are errors typed at the right boundary?
- Is useful context preserved?
- Are transient errors distinguished from permanent ones?
- Are retries safe and bounded?

## 5. API design
- Is the public surface minimal?
- Are invalid states representable?
- Are domain concepts modeled as types?

## 6. Security
- What inputs are untrusted?
- Can model output trigger privileged actions?
- Are authorization checks independent of model decisions?
- Could secrets leak through logs or errors?

## 7. Performance
- Is there a measured bottleneck?
- Are there unnecessary allocations, queries, or network calls?
- Is concurrency bounded?

## 8. Maintainability
- Can another engineer understand this in six months?
- Does the abstraction remove complexity or merely relocate it?

## Review output
Classify findings:
- `BLOCKER` — correctness/security/data-loss issue.
- `HIGH` — significant reliability or maintainability problem.
- `MEDIUM` — worthwhile improvement.
- `LOW` — style or optional refinement.

Do not manufacture findings. If the code is sound, say so.
