// Human-friendly PO number formatting — source: 04-CONTEXT.md D-21 (4-digit padding)

export function formatPONumber(poNumber: number): string {
  return `PO-${String(poNumber).padStart(4, "0")}`
}
