import { z } from "zod"

const quantityField = z.preprocess(
  (v) => (v === "" || v === null || v === undefined ? undefined : Number(v)),
  z.number().int().min(1, "Quantity must be at least 1.")
)

export const stockInSchema = z.object({
  productId: z.string().min(1, "Product is required."),
  quantity: quantityField,
  reason: z.enum(["Purchase Received", "Return", "Manual Adjustment"]),
  notes: z.string().optional(),
})

export const stockOutSchema = z.object({
  productId: z.string().min(1, "Product is required."),
  quantity: quantityField,
  reason: z.enum(["Sale", "Manual Adjustment", "Write-Off"]),
  notes: z.string().optional(),
})

export type StockInInput = z.infer<typeof stockInSchema>
export type StockOutInput = z.infer<typeof stockOutSchema>
