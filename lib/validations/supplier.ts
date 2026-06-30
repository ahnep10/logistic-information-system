import { z } from "zod"

export const createSupplierSchema = z.object({
  name: z.string().min(1, "Supplier name is required."),
  contactPerson: z.string().min(1, "Contact person is required."),
  phone: z.string().min(1, "Phone is required."),
  email: z.string().email("Please enter a valid email."),
  address: z.string().min(1, "Address is required."),
})

export const updateSupplierSchema = z.object({
  id: z.string(),
  name: z.string().min(1, "Supplier name is required."),
  contactPerson: z.string().min(1, "Contact person is required."),
  phone: z.string().min(1, "Phone is required."),
  email: z.string().email("Please enter a valid email."),
  address: z.string().min(1, "Address is required."),
})

export type CreateSupplierInput = z.infer<typeof createSupplierSchema>
export type UpdateSupplierInput = z.infer<typeof updateSupplierSchema>
