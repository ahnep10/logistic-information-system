import { z } from "zod"

const quantityField = z.preprocess(
  (v) => (v === "" || v === null || v === undefined ? undefined : Number(v)),
  z.number().int().min(1, "Quantity must be at least 1.")
)

const unitPriceField = z.preprocess(
  (v) => (v === "" || v === null || v === undefined ? undefined : Number(v)),
  z.number().min(0, "Unit price cannot be negative.")
)

const receivedQuantityField = z.preprocess(
  (v) => (v === "" || v === null || v === undefined ? undefined : Number(v)),
  z.number().int().min(0, "Received quantity cannot be negative.")
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
    .min(1),
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
