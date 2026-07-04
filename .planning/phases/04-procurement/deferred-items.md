# Deferred Items — Phase 04 (procurement)

Out-of-scope discoveries logged during plan execution, per executor scope-boundary rules.
Not fixed here — listed for visibility only.

## From 04-03 execution

- **REQUIREMENTS.md traceability drift (pre-existing, introduced in 04-01):** `PROC-02`, `PROC-03`,
  `PROC-04` are marked `[x]` Complete in `.planning/REQUIREMENTS.md` and the traceability table,
  even though only PROC-01 has been delivered as of 04-03 (04-02 shipped the list view; PROC-02/03/04
  — confirm/receive/immutability — are 04-04's scope, not yet executed). Introduced by commit
  `5956236` ("docs(04-01): complete purchase order schema and validation plan"), which appears to
  have marked all four Phase 4 PROC requirement IDs complete based on schema/validation groundwork
  rather than actual feature delivery. Out of scope for 04-03 (PROC-01 only) to correct — 04-04's
  executor should reconcile this when confirm/receive/immutability actually land, or a manual
  REQUIREMENTS.md correction can be applied independently.
