// PO status badge logic — source: 04-CONTEXT.md D-18 + 04-UI-SPEC.md "PO Status Badge Colors" table
// Shared between the purchase orders list and detail client components (04-02/04-04)

export type POStatus = "DRAFT" | "ORDERED" | "RECEIVED"

export interface POStatusBadgeProps {
  label: string
  className: string
}

export function getStatusBadge(status: POStatus): POStatusBadgeProps {
  if (status === "DRAFT") {
    return {
      label: "Draft",
      className: "bg-slate-100 text-slate-700 border border-slate-200 hover:bg-slate-100",
    }
  }
  if (status === "ORDERED") {
    return {
      label: "Ordered",
      className: "bg-blue-100 text-blue-700 border border-blue-200 hover:bg-blue-100",
    }
  }
  return {
    label: "Received",
    className: "bg-green-100 text-green-700 border border-green-200 hover:bg-green-100",
  }
}
