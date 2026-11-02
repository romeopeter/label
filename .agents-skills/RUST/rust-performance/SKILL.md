---
name: rust-performance
description: Diagnose and improve Rust performance without premature optimization, focusing on allocation, concurrency, I/O, and measurable bottlenecks.
---

# Rust Performance

## Objective
Optimize measured bottlenecks while preserving clarity and correctness.

## Rules
- Measure before optimizing.
- Identify whether the bottleneck is CPU, allocation, I/O, contention, serialization, network latency, or model latency.
- Prefer algorithmic improvements over micro-optimizations.
- Avoid unnecessary allocations in hot paths.
- Reuse buffers only when profiling justifies complexity.
- Consider borrowing before cloning, but do not contort APIs solely to avoid a cheap clone.
- Batch database and network operations where appropriate.
- Bound concurrency rather than maximizing it.
- Cache only when invalidation and memory costs are understood.
- For AI systems, measure model latency and token cost separately from Rust execution time.

## Agent-specific metrics
Track:
- model latency,
- time spent in tools,
- number of model turns,
- tool-call count,
- input/output tokens,
- retry count,
- failed tool calls,
- end-to-end latency.

## Rule
Never trade memory safety or understandable ownership for a speculative performance gain.
