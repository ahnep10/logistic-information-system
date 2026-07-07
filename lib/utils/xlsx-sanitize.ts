// CSV/Excel formula injection guard (CWE-1236) — source: 06-REVIEW.md CR-01.
//
// Any cell value that begins with `=`, `+`, `-`, `@`, tab, or CR is
// interpreted by Excel/LibreOffice/Google Sheets as a formula when the
// exported .xlsx is opened. Free-text fields that flow into report exports
// (e.g. stock-transaction `notes`) can carry attacker-controlled payloads
// across the STAFF -> MANAGER trust boundary, so every string cell handed to
// `XLSX.utils.json_to_sheet` in the /api/reports/* Route Handlers must be
// sanitized first.
const FORMULA_TRIGGER_RE = /^[=+\-@\t\r]/

export function sanitizeCell<T>(value: T): T {
  if (typeof value !== "string") return value
  return (FORMULA_TRIGGER_RE.test(value) ? `'${value}` : value) as T
}

// Applies sanitizeCell to every string value in a plain row object, leaving
// non-string values (numbers, booleans, etc.) untouched.
export function sanitizeRow<T extends Record<string, unknown>>(row: T): T {
  const sanitized = {} as T
  for (const key of Object.keys(row) as (keyof T)[]) {
    sanitized[key] = sanitizeCell(row[key])
  }
  return sanitized
}
