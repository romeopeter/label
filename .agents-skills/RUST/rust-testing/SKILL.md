---
name: rust-testing
description: Test Rust systems with unit, integration, property, async, and agent-specific evaluation strategies.
---

# Rust Testing

## Objective
Make correctness cheap to verify and regressions difficult to introduce.

## Rules
- Unit-test domain logic without requiring infrastructure.
- Integration-test public behavior and boundaries.
- Use fixtures/builders for complex test data.
- Prefer deterministic clocks, IDs, and random seeds in tests.
- Test error paths deliberately.
- Test cancellation and timeout behavior for async code.
- Avoid tests that depend on network services unless they are explicitly integration tests.
- Mock traits at architectural boundaries, not every function.
- Test serialization/deserialization contracts.

## AI-agent testing
Do not rely only on model-output snapshots.

Test:
1. tool selection constraints,
2. tool argument validation,
3. authorization,
4. loop termination,
5. retry behavior,
6. malformed model responses,
7. tool failures,
8. cancellation,
9. cost/token limits,
10. prompt-injection resistance.

Use recorded model responses or deterministic fake models for core orchestration tests.

## Property testing
Use property tests for:
- parsers,
- validators,
- serialization round trips,
- state transitions,
- normalization,
- collection invariants.

## Quality bar
A change is not complete when the happy path works. It is complete when the failure modes are understood and tested.
