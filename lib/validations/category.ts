import { z } from "zod"

export const createCategorySchema = z.object({
  name: z.string().trim().min(1, "Category name is required.").max(100),
})

export const updateCategorySchema = z.object({
  id: z.string().min(1, "ID is required"),
  name: z.string().trim().min(1, "Category name is required.").max(100),
})

export type CreateCategoryInput = z.infer<typeof createCategorySchema>
export type UpdateCategoryInput = z.infer<typeof updateCategorySchema>
