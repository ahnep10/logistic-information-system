import { z } from "zod"

export const createUserSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters."),
  email: z.string().email("Please enter a valid email."),
  role: z.enum(["MANAGER", "STAFF"]),
  password: z.string().min(8, "Password must be at least 8 characters."),
})

export const editUserSchema = z.object({
  id: z.string(),
  name: z.string().min(2, "Name must be at least 2 characters."),
  email: z.string().email("Please enter a valid email."),
  role: z.enum(["MANAGER", "STAFF"]),
  newPassword: z.string().min(8, "Password must be at least 8 characters.").optional(),
})

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, "Current password is required."),
    newPassword: z.string().min(8, "Password must be at least 8 characters."),
    confirmPassword: z.string(),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: "Passwords do not match.",
    path: ["confirmPassword"],
  })

export type CreateUserInput = z.infer<typeof createUserSchema>
export type EditUserInput = z.infer<typeof editUserSchema>
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>
