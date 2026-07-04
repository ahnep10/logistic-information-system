import { z } from "zod"

const quantityField = z.preprocess(
  (v) => (v === "" || v === null || v === undefined ? undefined : Number(v)),
  z
    .number()
    .int()
    .min(1, "Quantity must be at least 1.")
    .max(1_000_000, "Quantity is too large.")
)

const unitPriceField = z.preprocess(
  (v) => (v === "" || v === null || v === undefined ? undefined : Number(v)),
  z
    .number()
    .finite("Unit price must be a finite number.")
    .min(0, "Unit price cannot be negative.")
    .max(999_999_999.99, "Unit price is too large.")
)

const receivedQuantityField = z.preprocess(
  (v) => (v === "" || v === null || v === undefined ? undefined : Number(v)),
  z
    .number()
    .int()
    .min(0, "Received quantity cannot be negative.")
    .max(1_000_000, "Received quantity is too large.")
)

export const lineItemSchema = z.object({
  productId: z.string().min(1, "Product is required."),
  quantity: quantityField,
  unitPrice: unitPriceField,
})

export const createPurchaseOrderSchema = z.object({
  supplierId: z.string().min(1, "Supplier is required."),
  lineItems: z.array(lineItemSchema),
})

export const confirmPurchaseOrderSchema = z.object({
  lineItems: z
    .array(
      z.object({
        productId: z.string(),
        quantity: z.number(),
        unitPrice: z.number(),
      })
    )
    .min(1, "Add at least one line item before confirming this purchase order."),
})

export const receivePurchaseOrderSchema = z.object({
  lineItems: z
    .array(
      z.object({
        lineItemId: z.string().min(1, "Line item is required."),
        receivedQuantity: receivedQuantityField,
      })
    )
    .min(1)
    .refine(
      (items) =>
        new Set(items.map((li) => li.lineItemId)).size === items.length,
      { message: "Duplicate line item in receipt payload." }
    ),
})

export function assertPOEditable(status: string): void {
  if (status === "RECEIVED") {
    throw new Error("This purchase order has already been received.")
  }
}

export type LineItemInput = z.infer<typeof lineItemSchema>
export type CreatePurchaseOrderInput = z.infer<typeof createPurchaseOrderSchema>
export type ConfirmPurchaseOrderInput = z.infer<typeof confirmPurchaseOrderSchema>
export type ReceivePurchaseOrderInput = z.infer<typeof receivePurchaseOrderSchema>
