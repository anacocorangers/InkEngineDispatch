# InkEngine Dispatch instructions

- Keep this repository aligned with the InkEngine ecosystem naming and structure.
- Favor shared data contracts in `packages/contracts` over duplicating API types.
- Treat `apps/api` as the only network boundary for third-party sources.
- Keep adapters isolated in `apps/api/src/adapters` and avoid embedding source logic in route handlers.
- Preserve dashboard clarity in `apps/web` with source health and feed chronology as first-class views.
