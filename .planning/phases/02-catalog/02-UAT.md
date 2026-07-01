---
status: complete
phase: 02-catalog
source: 02-03-SUMMARY.md, 02-04-SUMMARY.md, 02-05-SUMMARY.md
started: 2026-06-30T00:00:00Z
updated: 2026-07-01T00:00:00Z
---

## Current Test

[testing complete]

## Tests

### 1. Categories page — view table
expected: Navigate to /categories. A table appears with columns: Name, Status, Actions. One or more categories are listed with a status badge (Active/Inactive) and action icons (pencil for edit, deactivate icon) in the Actions column. If no categories exist, an empty state shows a tag icon, "No categories yet", and "Create a category to organize your products." A "Create category" button is visible in the top-right area.
result: pass

### 2. Create a category
expected: Click "Create category". A dialog opens with a single "Name" text field and "Create category" / "Discard" buttons. Enter a name (e.g. "Electronics") and submit. The dialog closes, the table reloads, and the new category appears as Active. Submitting a blank name shows a validation error without closing the dialog.
result: pass

### 3. Edit a category
expected: Click the pencil icon on an existing category. A pre-filled dialog opens showing the current name. Change the name and click "Save changes". The dialog closes and the row reflects the updated name. Clicking "Discard changes" closes the dialog without updating.
result: pass

### 4. Duplicate category name blocked
expected: Try to create or edit a category using a name that already exists (including different casing, e.g. "electronics" when "Electronics" exists). The dialog stays open and shows an error message saying the name is already in use. The duplicate is not created.
result: pass

### 5. Deactivate a category
expected: Click the deactivate icon (person-with-X) on an Active category. An alert dialog appears: "Deactivate [name]?" with "Keep active" (cancel) and "Deactivate category" (confirm) buttons. Clicking confirm marks the category Inactive in the table. Clicking "Keep active" closes the dialog with no change.
result: pass

### 6. Reactivate a category
expected: Find an Inactive category. Click the reactivate icon (person-with-checkmark). An alert dialog appears asking to confirm reactivation. Clicking confirm switches the category back to Active.
result: pass

### 7. Products page — view with severity badges
expected: Navigate to /products. An 8-column table appears: Name, SKU (monospace), Category, Threshold, Stock, Severity, Status, Actions. Each row shows a colored Severity badge — Critical (red, stock=0), Warning (amber, stock ≤ threshold), OK (green, stock > threshold). Newly created products all show Critical since stock starts at 0.
result: pass

### 8. Create a product
expected: Click "Create product". A dialog opens with fields: Name, SKU, Category (dropdown of active categories only), Reorder Threshold (number). Submit with valid data. The dialog closes, the new product appears in the table with currentStock=0 and Severity=Critical. The Stock and Threshold columns show the correct values.
result: pass

### 9. Duplicate SKU shows field-level error
expected: Try to create a product using a SKU that already exists. The dialog stays open and the SKU field itself shows a validation error ("SKU already in use" or similar). The error appears inline under the SKU input, not as a generic banner.
result: pass

### 10. Edit product — inactive category shown in dropdown
expected: Deactivate a category that is assigned to a product. Open the Edit dialog for that product. The inactive category still appears in the Category dropdown but is visually marked as "(inactive)" and disabled — it cannot be selected. Other active categories remain selectable.
result: pass

### 11. Suppliers page — Tabs filter
expected: Navigate to /suppliers. Three tabs appear above the table: "All", "Active", "Inactive". Clicking "Active" shows only active suppliers. Clicking "Inactive" shows only inactive ones. Clicking "All" restores the full list. No page reload occurs between tab switches.
result: pass

### 12. Tab-aware empty states
expected: When a tab has no matching suppliers, the empty state text changes based on which tab is active — "No suppliers yet / Create a supplier…" for All, "No active suppliers / All suppliers are currently deactivated." for Active, "No inactive suppliers / All suppliers are currently active." for Inactive.
result: pass

### 13. Create a supplier
expected: Click "Create supplier". A dialog opens with 5 fields: Name, Contact Person, Phone, Email, and Address (a multi-line textarea, not a single-line input). Submit with valid data. The new supplier appears in the table.
result: pass

### 14. Staff role — read-only views
expected: Log in as a Staff user (or simulate by checking behavior). On the Categories, Products, and Suppliers pages, the "Create" button is absent and the Actions column is hidden entirely. Staff can view the table data but cannot create, edit, deactivate, or reactivate any records.
result: pass

## Summary

total: 14
passed: 14
issues: 0
pending: 0
skipped: 0
blocked: 0

## Gaps

[none yet]
