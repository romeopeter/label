---
name: rust-async-tokio
description: Build correct concurrent Rust services with Tokio, async/await, channels, cancellation, timeouts, and bounded concurrency.
---

# Async Rust with Tokio

## Objective
Build asynchronous systems that remain responsive under load and shut down cleanly.

## Rules
- Never block an async runtime thread with synchronous I/O or CPU-heavy work.
- Use Tokio synchronization primitives only when their async behavior is needed.
- Put explicit timeouts around network/tool calls that can hang.
- Bound concurrency for fan-out workloads.
- Propagate cancellation through `CancellationToken` or equivalent application-level mechanisms.
- Prefer structured concurrency patterns over detached background tasks.
- Every spawned task needs a clear owner, lifecycle, and error policy.
- Do not silently discard `JoinHandle` failures.
- Avoid holding mutexes across `.await`.
- Keep critical sections small.
- Prefer message passing over shared mutable state when it makes ownership clearer.
- Use `Arc` only when shared ownership is actually required.
- Use `tokio::select!` carefully and make cancellation behavior explicit.

## AI-agent rule
Tool calls must have:
- input validation,
- timeout,
- cancellation,
- bounded retries,
- structured result/error mapping,
- telemetry.

Never allow an agent loop to create unbounded concurrent tool calls.

## Review checklist
- What happens if this future never completes?
- What happens when the request is cancelled?
- Can concurrency grow without bound?
- Is any synchronous operation running on the async executor?
- Who owns each spawned task?
