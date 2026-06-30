"use client"
import { useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { Loader2 } from "lucide-react"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
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
import { login } from "@/actions/auth"
import { loginSchema } from "@/lib/validations/auth"

type LoginFormValues = z.infer<typeof loginSchema>

export default function LoginPage() {
  const [serverError, setServerError] = useState<string | null>(null)

  const form = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  })

  const { formState: { isSubmitting } } = form

  async function onSubmit(values: LoginFormValues) {
    setServerError(null)
    const formData = new FormData()
    formData.append("email", values.email)
    formData.append("password", values.password)
    const result = await login(formData)
    if (result?.error) {
      setServerError(result.error)
    }
    // On success, the Server Action calls redirect("/") which middleware intercepts
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-zinc-50">
      <Card className="max-w-sm w-full mx-4 shadow-sm border border-zinc-200">
        <CardHeader className="space-y-1 pb-4">
          <h1 className="text-2xl font-semibold text-center">Logistics MIS</h1>
          <p className="text-sm text-zinc-500 text-center mt-1">
            Sign in to your account
          </p>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email</FormLabel>
                    <FormControl>
                      <Input
                        type="email"
                        autoComplete="email"
                        placeholder="you@company.com"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Password</FormLabel>
                    <FormControl>
                      <Input
                        type="password"
                        autoComplete="current-password"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              {serverError && (
                <p className="text-xs text-red-600">{serverError}</p>
              )}
              <Button
                type="submit"
                className="w-full"
                variant="default"
                disabled={isSubmitting}
              >
                {isSubmitting && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                Sign in
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  )
}
