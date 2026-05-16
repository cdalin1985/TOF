# Feature Builder Summary

## Task

Admin player management slice 2: move player activate/deactivate behind an admin Edge Function with audit logging.

## Scope

- Add a server-side admin endpoint for changing `players.is_active`.
- Update the Admin Players tab to call the endpoint instead of directly updating the `players` table.
- Add audit logging for player activation and deactivation.

## Guardrails

- No challenge rule changes.
- No ranking challenge range changes.
- No race length rule changes.
- No cooldown rule changes.
- No treasury permission changes.
- No starting-rank placement.

## Risk

medium
