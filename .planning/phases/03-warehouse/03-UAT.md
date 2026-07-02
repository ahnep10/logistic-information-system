---
status: testing
phase: 03-warehouse
source: [03-VERIFICATION.md]
started: 2026-07-02T08:00:00.000Z
updated: 2026-07-02T08:00:00.000Z
---

## Current Test

number: 1
name: Record Stock In — end-to-end submission
expected: |
  Dialog closes; a new row appears at the top of the Recent Transactions table with a green "IN" badge; navigating to /products shows the product's stock level increased by the entered quantity.
awaiting: user response

## Tests

### 1. Record Stock In — end-to-end submission
expected: Log in as any user, navigate to /stock, click "Record Stock In", select a product, enter a quantity, choose a reason, submit. Dialog closes; a new row appears at the top of the Recent Transactions table with a green "IN" badge; navigating to /products shows the product's stock level increased by the entered quantity.
result: [pending]

### 2. Record Stock Out — insufficient-stock error handling
expected: Navigate to /stock, click "Record Stock Out", select a product with a known current stock level, enter a quantity greater than that level, submit. An inline error "Insufficient stock. Current stock: N units." appears inside the dialog; the dialog stays open; the entered form values are not cleared.
result: [pending]

## Summary

total: 2
passed: 0
issues: 0
pending: 2
skipped: 0
blocked: 0

## Gaps
