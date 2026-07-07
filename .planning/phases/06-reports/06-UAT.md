---
status: testing
phase: 06-reports
source: [06-VERIFICATION.md]
started: 2026-07-07T05:08:38Z
updated: 2026-07-07T05:08:38Z
---

## Current Test

number: 1
name: Downloaded .xlsx files open correctly and match on-screen data
expected: |
  Log in as Manager, visit /reports, click each tab's "Export to Excel" link, and open each
  downloaded .xlsx file in Excel/LibreOffice. The Inventory file's columns match the on-screen
  table; the Movements file's rows match the currently-applied date range; the Purchase Orders
  file's Total column matches the on-screen currency values (a real spreadsheet, not
  corrupt/empty).
awaiting: user response

## Tests

### 1. Downloaded .xlsx files open correctly and match on-screen data
expected: Log in as Manager, visit /reports, click each tab's "Export to Excel" link, and open each downloaded .xlsx file in Excel/LibreOffice. The Inventory file's columns match the on-screen table; the Movements file's rows match the currently-applied date range; the Purchase Orders file's Total column matches the on-screen currency values.
result: [pending]

### 2. Non-MANAGER users cannot download reports via a real session
expected: As a STAFF-role user (or logged out), request /api/reports/inventory, /api/reports/movements, and /api/reports/purchase-orders directly. The request is rejected (401 if logged out, 403 if STAFF) and no file downloads.
result: [pending]

## Summary

total: 2
passed: 0
issues: 0
pending: 2
skipped: 0
blocked: 0

## Gaps
