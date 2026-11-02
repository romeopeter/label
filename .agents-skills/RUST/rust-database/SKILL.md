---
name: rust-database
description: Design reliable Rust database access with SQLx/Postgres, transactions, repositories, migrations, pooling, and concurrency control.
---

# Rust Database Engineering

## Objective
Keep persistence reliable, explicit, observable, and difficult to misuse.

## Rules
- Prefer Postgres for relational domain data when relational integrity matters.
- Use SQLx compile-time checked queries where practical.
- Keep SQL close to the repository/data-access layer.
- Use transactions for multi-step state changes that must be atomic.
- Never assume a transaction succeeded because individual statements returned successfully; commit must succeed.
- Configure connection pool limits deliberately.
- Add query timeouts for expensive or unbounded operations.
- Use indexes based on actual query patterns.
- Avoid N+1 query patterns.
- Prefer pagination for large datasets.
- Use database constraints to enforce invariants that must hold regardless of application code.
- Store timestamps consistently and make timezone assumptions explicit.

## AI-agent persistence
Persist:
- durable business state,
- audit records,
- explicit agent execution metadata when required.

Do not persist every model thought or raw context by default.

## Concurrency
Use transactions and appropriate isolation/locking when multiple workers can update the same logical resource.
