// IMPORTANT: currentStock is intentionally excluded per D-04/D-05.
// Stock is managed exclusively by Phase 3 stock transactions.
import { z } from "zod"

export const createProductSchema = z.object({
  name: z.string().min(1, "Product name is required."),
  sku: z.string().min(1, "SKU is required.").max(50).trim(),
  categoryId: z.string().min(1, "Category is required."),
  reorderThreshold: z.coerce.number().int().min(0, "Must be 0 or greater"),
})

export const updateProductSchema = z.object({
  id: z.string(),
  name: z.string().min(1, "Product name is required."),
  sku: z.string().min(1, "SKU is required.").max(50).trim(),
  categoryId: z.string().min(1, "Category is required."),
  reorderThreshold: z.coerce.number().int().min(0, "Must be 0 or greater"),
})

export type CreateProductInput = z.infer<typeof createProductSchema>
export type UpdateProductInput = z.infer<typeof updateProductSchema>
