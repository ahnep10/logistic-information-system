// IMPORTANT: currentStock is intentionally excluded per D-04/D-05.
// Stock is managed exclusively by Phase 3 stock transactions.
import { z } from "zod"

export const createProductSchema = z.object({
  name: z.string().trim().min(1, "Product name is required.").max(200),
  sku: z.string().trim().min(1, "SKU is required.").max(50),
  categoryId: z.string().min(1, "Category is required."),
  reorderThreshold: z.preprocess(
    (v) => (v === "" || v === null || v === undefined ? undefined : Number(v)),
    z.number().int().min(0, "Must be 0 or greater")
  ),
})

export const updateProductSchema = z.object({
  id: z.string().min(1, "ID is required"),
  name: z.string().trim().min(1, "Product name is required.").max(200),
  sku: z.string().trim().min(1, "SKU is required.").max(50),
  categoryId: z.string().min(1, "Category is required."),
  reorderThreshold: z.preprocess(
    (v) => (v === "" || v === null || v === undefined ? undefined : Number(v)),
    z.number().int().min(0, "Must be 0 or greater")
  ),
})

export type CreateProductInput = z.infer<typeof createProductSchema>
export type UpdateProductInput = z.infer<typeof updateProductSchema>
