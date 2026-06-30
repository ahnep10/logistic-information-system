// Severity tier logic — source: 02-CONTEXT.md D-06 + 02-UI-SPEC.md Color section
// Shared between Phase 2 (Products page) and Phase 3 (Warehouse inventory screens)

export type SeverityTier = "Critical" | "Warning" | "OK"

export interface SeverityBadgeProps {
  label: SeverityTier
  className: string
}

export function getSeverityBadge(
  currentStock: number,
  reorderThreshold: number
): SeverityBadgeProps {
  if (currentStock === 0) {
    return {
      label: "Critical",
      className: "bg-red-100 text-red-700 border border-red-200 hover:bg-red-100",
    }
  }
  if (currentStock <= reorderThreshold) {
    return {
      label: "Warning",
      className: "bg-amber-100 text-amber-700 border border-amber-200 hover:bg-amber-100",
    }
  }
  return {
    label: "OK",
    className: "bg-green-100 text-green-700 border border-green-200 hover:bg-green-100",
  }
}
