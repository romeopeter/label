---
name: rust-observability
description: Instrument Rust applications and AI agents with structured logs, traces, metrics, correlation IDs, and actionable telemetry.
---

# Rust Observability

## Objective
Make production behavior explainable without logging sensitive data.

## Rules
- Use `tracing` for structured logs and spans.
- Attach request/job/agent execution IDs.
- Record durations and outcome status.
- Record retries and external dependency failures.
- Use metrics for aggregate behavior; logs for individual events; traces for request flow.
- Never log passwords, API keys, session tokens, authorization headers, or sensitive user content.
- Redact model prompts/responses unless explicitly required and appropriately protected.

## Agent telemetry
Capture:
- execution ID,
- model/provider,
- model latency,
- tool name,
- tool duration,
- tool success/failure,
- iteration count,
- token usage when available,
- termination reason,
- policy decisions.

## Useful termination reasons
```text
completed
max_iterations
timeout
cancelled
budget_exceeded
tool_failure
model_failure
policy_denied
```

These are much more useful than a generic `agent failed`.
