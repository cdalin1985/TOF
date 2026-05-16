# Feature Builder Summary

Provider: openai

## Task

Admin player management hardening slice 1 add claimed profile status and add-player edge function

## Summary

Implemented a hardened Supabase add-player Edge Function for admin player management. New players are created unclaimed at the bottom of the unified ranking list with initialized metrics/stats rows, audit logging, duplicate-name protection, admin authorization, and claimed profile status in responses.

## Risk

medium

## Notes

- The current Admin Players UI already displays claimed/unclaimed based on players.profile_id and calls /functions/v1/add-player.
- The function uses the service role key server-side, verifies the caller is admin or super_admin, and does not change TOC challenge/ranking rules.
- Writes span multiple tables; rollback cleanup is included, but this is not a true Postgres transaction.

## Files proposed

- `supabase/functions/add-player/index.ts`
