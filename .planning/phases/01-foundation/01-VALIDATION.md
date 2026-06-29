---
phase: 1
slug: foundation
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-06-29
---

# Phase 1 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest (to be installed in Wave 0) |
| **Config file** | `vitest.config.ts` (Wave 0 gap) |
| **Quick run command** | `npx vitest run --reporter=dot` |
| **Full suite command** | `npx vitest run` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run --reporter=dot`
- **After every plan wave:** Run `npx vitest run`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** ~15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 01-auth-01 | auth | 1 | AUTH-01 | T-1-01 | Valid credentials → session + redirect to role home | Integration | `npx vitest run tests/auth.test.ts` | ❌ W0 | ⬜ pending |
| 01-auth-02 | auth | 1 | AUTH-01 | T-1-01 | Invalid credentials → error message returned | Integration | `npx vitest run tests/auth.test.ts` | ❌ W0 | ⬜ pending |
| 01-auth-03 | auth | 1 | AUTH-01 | T-1-01 | Deactivated user → login rejected | Integration | `npx vitest run tests/auth.test.ts` | ❌ W0 | ⬜ pending |
| 01-auth-04 | auth | 1 | AUTH-02 | — | JWT cookie persists across simulated refresh | Unit | `npx vitest run tests/session.test.ts` | ❌ W0 | ⬜ pending |
| 01-rbac-01 | auth | 2 | AUTH-03 | T-1-02 | STAFF accessing /dashboard → redirect to /inventory | Unit | `npx vitest run tests/middleware.test.ts` | ❌ W0 | ⬜ pending |
| 01-rbac-02 | auth | 2 | AUTH-03 | T-1-02 | Unauthenticated → redirect to /login | Unit | `npx vitest run tests/middleware.test.ts` | ❌ W0 | ⬜ pending |
| 01-rbac-03 | auth | 2 | AUTH-03 | T-1-02 | MANAGER accessing /dashboard → allowed | Unit | `npx vitest run tests/middleware.test.ts` | ❌ W0 | ⬜ pending |
| 01-sidebar-01 | shell | 2 | AUTH-03 | — | MANAGER sidebar renders 9 items | Unit | `npx vitest run tests/sidebar.test.tsx` | ❌ W0 | ⬜ pending |
| 01-sidebar-02 | shell | 2 | AUTH-03 | — | STAFF sidebar renders 6 items (no Dashboard/Reports/Users) | Unit | `npx vitest run tests/sidebar.test.tsx` | ❌ W0 | ⬜ pending |
| 01-users-01 | users | 3 | AUTH-03 | — | Manager creates user → user appears in DB | Integration | `npx vitest run tests/users.test.ts` | ❌ W0 | ⬜ pending |
| 01-users-02 | users | 3 | AUTH-03 | — | Password change: mismatched → rejected (Zod) | Unit | `npx vitest run tests/validations.test.ts` | ❌ W0 | ⬜ pending |
| 01-users-03 | users | 3 | AUTH-03 | — | Password change: wrong current password → rejected | Integration | `npx vitest run tests/users.test.ts` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `tests/auth.test.ts` — stubs for AUTH-01, AUTH-02 (login flow, session persistence)
- [ ] `tests/middleware.test.ts` — stubs for AUTH-03 (route guard logic)
- [ ] `tests/sidebar.test.tsx` — stubs for role-conditional nav rendering
- [ ] `tests/users.test.ts` — stubs for user CRUD and password change
- [ ] `tests/validations.test.ts` — stubs for Zod schema edge cases
- [ ] `vitest.config.ts` — Vitest config with jsdom environment
- [ ] `tests/setup.ts` — Vitest setup file

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Browser session persists after hard refresh (F5) | AUTH-02 | Requires real browser cookie inspection | Log in, hard-refresh, verify no redirect to /login |
| Dark sidebar + white main content visual appearance | UI-SPEC D-10 | Visual regression only | Check sidebar is slate-900, main area is white |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
