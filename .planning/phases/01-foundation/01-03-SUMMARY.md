---
phase: "01"
plan: "03"
subsystem: test-infrastructure
status: complete
tags:
  - vitest
  - testing
  - wave-0
  - test-stubs
  - auth
  - rbac

dependency_graph:
  requires:
    - 01-01A (Next.js scaffold, package.json created)
    - 01-01B (app shell, auth files, sidebar component)
  provides:
    - Wave 0 test contract for plans 01-04 and beyond
    - npx vitest run as a valid CI command
  affects:
    - 01-04-PLAN.md (fills in it.todo stubs for auth and user management)
    - All future plans that add npx vitest run to their verify blocks

tech_stack:
  added:
    - vitest@4.1.9
    - "@vitejs/plugin-react@6.0.3"
    - "@testing-library/react@16.3.2"
    - "@testing-library/dom@10.4.1"
    - jsdom@29.1.1
  patterns:
    - it.todo stubs for Wave 0 coverage (not it.skip)
    - jsdom environment for DOM-dependent test files (.tsx)
    - globals: true for describe/it/expect without explicit imports
    - passWithNoTests: true to handle Vitest 4.x behavior change
    - tests/vitest.d.ts triple-slash reference for TypeScript strict compliance

key_files:
  created:
    - vitest.config.ts
    - tests/setup.ts
    - tests/auth.test.ts
    - tests/middleware.test.ts
    - tests/sidebar.test.tsx
    - tests/users.test.ts
    - tests/validations.test.ts
    - tests/vitest.d.ts
  modified:
    - package.json (added test/test:watch/test:coverage scripts; added 5 devDependencies)
    - package-lock.json

decisions:
  - passWithNoTests: true added to vitest.config.ts — Vitest 4.x exits code 1 when no test files are found (changed from prior versions); passWithNoTests: true restores exit 0 for empty suites
  - tests/vitest.d.ts with triple-slash reference chosen over modifying tsconfig.json types array — avoids overriding Next.js implicit @types package discovery
  - --legacy-peer-deps required for npm install — @vitejs/plugin-react@6.0.3 has optional peer dep on @babel/core@^8.0.0 but shadcn requires @babel/core@^7.x; optional conflict does not affect runtime functionality

metrics:
  duration: "~18m"
  completed: "2026-06-30"
  tasks_completed: 2
  files_created: 8
  files_modified: 2
---

# Phase 01 Plan 03: Test Scaffolding Summary

**One-liner:** Vitest 4.x installed with jsdom environment; 12 it.todo stubs across 5 files map every VALIDATION.md row — Wave 0 test contract established.

## What Was Built

Installed the Vitest testing framework and created the Wave 0 test contract files. Every row in the Phase 1 VALIDATION.md Per-Task Verification Map now has a corresponding `it.todo` stub in the correct test file. The stubs use `it.todo` (not `it.skip`) so they are semantically "not yet implemented" rather than intentionally skipped. `npx vitest run` exits 0 in under 15 seconds, establishing the automated feedback loop required by the Nyquist validation rule.

## Commits

| Task | Commit | Description |
|------|--------|-------------|
| Task 1 | `843e46a` | Install Vitest and create test infrastructure (vitest.config.ts, tests/setup.ts, package.json scripts) |
| Task 2 | `80f388a` | Create Wave 0 test stub files — 12 it.todo stubs across 5 files |

## Test Coverage Map

| File | Stubs | Requirements |
|------|-------|-------------|
| tests/auth.test.ts | 4 | AUTH-01 (3 cases), AUTH-02 (1 case) |
| tests/middleware.test.ts | 3 | AUTH-03 RBAC (STAFF redirect, unauth redirect, MANAGER pass) |
| tests/sidebar.test.tsx | 2 | D-06 (MANAGER 9 items), D-07 (STAFF 6 items absent not hidden) |
| tests/users.test.ts | 2 | D-03 (createUser to DB), D-05 (wrong password rejected) |
| tests/validations.test.ts | 1 | D-05 (Zod changePasswordSchema mismatch) |
| **Total** | **12** | **All VALIDATION.md rows covered** |

## Verification Results

| Check | Result |
|-------|--------|
| `npx vitest run --reporter=verbose` | 12 todo, 0 failures, exit 0 |
| `npx tsc --noEmit` | 0 errors, exit 0 |
| `npm test -- --reporter=dot` | 12 todo, 0 failures, exit 0 |
| Duration | ~2 seconds (well under 15s limit) |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Vitest 4.x exits code 1 with no test files**
- **Found during:** Task 1 verification (`npx vitest run --reporter=dot` returned exit code 1)
- **Issue:** Vitest 4.x changed behavior from prior versions — exits code 1 when no test files match the include pattern. The plan assumed older behavior where it would exit 0.
- **Fix:** Added `passWithNoTests: true` to vitest.config.ts test options. This restores the expected exit 0 behavior for empty suites.
- **Files modified:** vitest.config.ts
- **Commit:** 843e46a (included in Task 1 commit)

**2. [Rule 2 - Missing Critical Functionality] TypeScript global type declarations for Vitest**
- **Found during:** Task 2 verification (`npx tsc --noEmit` returned 17 errors for `describe` and `it` not found)
- **Issue:** With `globals: true` in vitest.config.ts, Vitest injects `describe`, `it`, `expect` etc. as globals at runtime, but TypeScript has no type information for them. The plan specified `npx tsc --noEmit` must exit 0 as a success criterion.
- **Fix:** Created `tests/vitest.d.ts` with `/// <reference types="vitest/globals" />` triple-slash directive. Chosen over modifying tsconfig.json `types` array (which would override auto-discovery of `@types/node`, `@types/react`, etc.).
- **Files modified:** tests/vitest.d.ts (created)
- **Commit:** 80f388a (included in Task 2 commit)

**3. [Rule 3 - Blocking Issue] @vitejs/plugin-react peer dependency conflict**
- **Found during:** Task 1 `npm install` step
- **Issue:** `@vitejs/plugin-react@6.0.3` has an optional peer dependency on `@rolldown/plugin-babel` which requires `@babel/core@^8.0.0`, but `shadcn@4.12.0` requires `@babel/core@^7.x`.
- **Fix:** Used `--legacy-peer-deps` flag. The conflict is via optional transitive peer dependencies (`peerOptional` chain) — the babel 8 dependency is only needed if babel-based code transformation is explicitly configured, which it is not in this project. `--legacy-peer-deps` resolves this without functional impact.
- **Files modified:** package.json, package-lock.json (installed packages)
- **Commit:** 843e46a (included in Task 1 commit)

## Known Stubs

All test files are intentional stubs — this plan's purpose is Wave 0 coverage (stubs only). The stubs are NOT implementation gaps; they are the planned output. They will be filled in by Plan 01-04.

| Stub | File | Reason |
|------|------|--------|
| 12 `it.todo` stubs | tests/*.test.{ts,tsx} | Wave 0 contract — implementations deferred to Plan 01-04 |

## Threat Surface Scan

No new security-relevant surface was introduced. Test files only contain stub declarations with no imports, no network calls, and no secrets. The `tests/` directory uses mock credentials patterns (documented in the threat model as accepted with low severity).

## Self-Check: PASSED

| Item | Status |
|------|--------|
| vitest.config.ts | FOUND |
| tests/setup.ts | FOUND |
| tests/auth.test.ts | FOUND |
| tests/middleware.test.ts | FOUND |
| tests/sidebar.test.tsx | FOUND |
| tests/users.test.ts | FOUND |
| tests/validations.test.ts | FOUND |
| tests/vitest.d.ts | FOUND |
| Commit 843e46a | FOUND |
| Commit 80f388a | FOUND |
