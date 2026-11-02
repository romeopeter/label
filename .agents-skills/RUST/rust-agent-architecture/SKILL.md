---
name: rust-agent-architecture
description: Design production-grade AI agents in Rust with typed state, tool abstractions, bounded loops, memory boundaries, and deterministic orchestration.
---

# Rust AI Agent Architecture

## Objective
Build AI agents as ordinary reliable software systems with an LLM at the decision boundary—not as an uncontrolled prompt loop.

## Recommended layers

```text
interface
  -> agent orchestration
      -> policy / state machine
          -> model adapter
          -> tool registry
          -> memory/retrieval
          -> domain services
              -> infrastructure
```

Keep model-specific code behind a trait.

```rust
#[async_trait::async_trait]
pub trait Model {
    async fn complete(&self, request: ModelRequest) -> Result<ModelResponse, ModelError>;
}
```

Tools should also be typed.

```rust
#[async_trait::async_trait]
pub trait Tool: Send + Sync {
    fn name(&self) -> &'static str;
    fn description(&self) -> &'static str;
    async fn execute(&self, input: serde_json::Value) -> Result<ToolOutput, ToolError>;
}
```

## Agent loop requirements
Every agent loop must have:
- maximum iterations,
- maximum wall-clock duration,
- token/cost budget where available,
- tool-call limits,
- cancellation support,
- explicit terminal states,
- observable transitions.

Represent state explicitly:

```rust
enum AgentState {
    Planning,
    CallingTool,
    ProcessingResult,
    WaitingForModel,
    Completed,
    Failed,
    Cancelled,
}
```

Do not make the model responsible for enforcing safety or resource limits. The Rust orchestrator enforces them.

## Tool design
- One tool should have one clear responsibility.
- Validate inputs before execution.
- Return structured outputs.
- Keep secrets out of model-visible output.
- Make destructive operations require explicit authorization/policy checks.
- Prefer idempotent tools where possible.

## Memory
Separate:
- conversation state,
- working memory,
- durable user/application data,
- retrieval/index data.

Do not silently treat model context as durable storage.

## Determinism
Where possible, isolate nondeterministic model decisions from deterministic business logic. The agent decides *what* to do; domain services decide *how* it is safely done.
