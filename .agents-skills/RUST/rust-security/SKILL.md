---
name: rust-security
description: Apply secure Rust engineering practices for APIs, agents, tools, secrets, serialization, and untrusted input.
---

# Rust Security

## Objective
Treat all external input—including LLM output—as untrusted.

## Rules
- Validate at trust boundaries.
- Use allowlists for privileged operations.
- Never execute shell commands directly from model-generated strings without strict validation and authorization.
- Never place secrets in prompts, logs, traces, tool output, or serialized agent state.
- Apply least privilege to tools.
- Separate user authorization from model intent.
- Do not let the model decide whether it is authorized.
- Protect against prompt injection by treating retrieved documents and tool output as untrusted data.
- Set resource limits on files, requests, payloads, recursion, loops, and concurrency.
- Use secure secret storage/environment injection.
- Avoid `unsafe` unless necessary and reviewed.
- Keep dependencies current and audit critical dependencies.

## Agent security boundary

```text
User input
   ↓
validation
   ↓
policy / authorization
   ↓
agent decision
   ↓
tool validation
   ↓
side effect
```

Never invert that order.

## High-risk operations
Require explicit policy checks for:
- money movement,
- account changes,
- deletion,
- publishing,
- external communication,
- shell execution,
- infrastructure changes,
- access to private data.

The model may request the operation; the application decides whether it may happen.
