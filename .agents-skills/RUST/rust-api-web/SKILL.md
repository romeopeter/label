---
name: rust-api-web
description: Build production HTTP APIs in Rust with Axum, typed request handling, middleware, validation, observability, and clean application boundaries.
---

# Rust HTTP APIs

## Objective
Build APIs that are boring in the best possible way.

## Recommended structure

```text
src/
  main.rs
  app.rs
  config.rs
  error.rs
  http/
    routes.rs
    handlers/
    middleware/
  domain/
  services/
  repositories/
  agents/
  infrastructure/
```

## Rules
- Keep handlers thin.
- Validate request data before invoking domain services.
- Keep business logic out of HTTP handlers.
- Map domain errors to HTTP responses in one place.
- Use typed request/response DTOs.
- Set request body limits.
- Configure timeouts.
- Add structured request IDs.
- Do not leak internal errors to clients.
- Separate authentication from authorization.
- Prefer dependency injection through application state rather than globals.

## Handler pattern

```rust
async fn create_item(
    State(app): State<AppState>,
    Json(input): Json<CreateItem>,
) -> Result<Json<ItemResponse>, ApiError> {
    let item = app.items.create(input).await?;
    Ok(Json(item.into()))
}
```

The handler should orchestrate, not become the application.

## API compatibility
Treat serialized schemas as contracts. Changes to public JSON structures should be deliberate and tested.
