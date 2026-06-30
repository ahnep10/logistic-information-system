"use client"

import { useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { Loader2 } from "lucide-react"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"

import {
  changePasswordSchema,
  type ChangePasswordInput,
} from "@/lib/validations/user"
import { changeOwnPassword } from "@/actions/users"

interface ChangePasswordFormProps {
  currentUserName: string
  currentUserEmail: string
}

export default function ChangePasswordForm({
  currentUserName,
  currentUserEmail,
}: ChangePasswordFormProps) {
  const [successMsg, setSuccessMsg] = useState<string | null>(null)

  const form = useForm<ChangePasswordInput>({
    resolver: zodResolver(changePasswordSchema),
    defaultValues: {
      currentPassword: "",
      newPassword: "",
      confirmPassword: "",
    },
  })

  async function onSubmit(values: ChangePasswordInput) {
    setSuccessMsg(null)

    const fd = new FormData()
    fd.append("currentPassword", values.currentPassword)
    fd.append("newPassword", values.newPassword)
    fd.append("confirmPassword", values.confirmPassword)

    const result = await changeOwnPassword(fd)

    if (result?.error) {
      const err = result.error
      if (typeof err === "object" && !Array.isArray(err)) {
        const fieldErrors = err as Record<string, string[]>
        if (fieldErrors.currentPassword?.[0]) {
          form.setError("currentPassword", { message: fieldErrors.currentPassword[0] })
        }
        if (fieldErrors.confirmPassword?.[0]) {
          form.setError("confirmPassword", { message: fieldErrors.confirmPassword[0] })
        }
      }
      return
    }

    if (result?.success) {
      form.reset()
      setSuccessMsg("Password updated successfully.")
      setTimeout(() => setSuccessMsg(null), 3000)
    }
  }

  return (
    <Card className="max-w-md">
      <CardHeader>
        <CardTitle className="text-xl font-semibold">Change Password</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="mb-4">
          <p className="text-sm text-zinc-500">{currentUserName}</p>
          <p className="text-sm text-zinc-500">{currentUserEmail}</p>
        </div>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="currentPassword"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Current password</FormLabel>
                  <FormControl>
                    <Input type="password" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="newPassword"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>New password</FormLabel>
                  <FormControl>
                    <Input type="password" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="confirmPassword"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Confirm new password</FormLabel>
                  <FormControl>
                    <Input type="password" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {successMsg && (
              <p className="text-sm text-green-600">{successMsg}</p>
            )}

            <Button
              type="submit"
              className="mt-4 w-full"
              disabled={form.formState.isSubmitting}
            >
              {form.formState.isSubmitting && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Update password
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  )
}
