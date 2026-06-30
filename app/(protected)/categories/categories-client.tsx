"use client"

import { useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { Pencil, EyeOff, Eye, Loader2, Tag } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card } from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"

import {
  createCategorySchema,
  updateCategorySchema,
  type CreateCategoryInput,
  type UpdateCategoryInput,
} from "@/lib/validations/category"
import {
  createCategory,
  updateCategory,
  toggleCategoryActive,
} from "@/actions/categories"

interface Category {
  id: string
  name: string
  isActive: boolean
}

interface CategoriesClientProps {
  categories: Category[]
  isManager: boolean
}

export default function CategoriesClient({
  categories,
  isManager,
}: CategoriesClientProps) {
  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold">Categories</h1>
        {isManager && <CreateCategoryDialog />}
      </div>

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Status</TableHead>
              {isManager && (
                <TableHead className="text-right">Actions</TableHead>
              )}
            </TableRow>
          </TableHeader>
          <TableBody>
            {categories.length === 0 ? (
              <TableRow>
                <TableCell colSpan={isManager ? 3 : 2}>
                  <div className="flex flex-col items-center py-12 text-center">
                    <Tag className="w-8 h-8 text-zinc-300 mb-3" />
                    <p className="text-sm font-medium text-zinc-900">
                      No categories yet
                    </p>
                    <p className="text-sm text-zinc-500 mt-1">
                      Create a category to organize your products.
                    </p>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              categories.map((category) => (
                <TableRow key={category.id}>
                  <TableCell className="text-sm">{category.name}</TableCell>
                  <TableCell>
                    <Badge
                      variant={category.isActive ? "default" : "secondary"}
                    >
                      {category.isActive ? "Active" : "Inactive"}
                    </Badge>
                  </TableCell>
                  {isManager && (
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <EditCategoryDialog category={category} />
                        {category.isActive ? (
                          <DeactivateCategoryDialog category={category} />
                        ) : (
                          <ReactivateCategoryDialog category={category} />
                        )}
                      </div>
                    </TableCell>
                  )}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>
    </div>
  )
}

// ── Create Category Dialog ──────────────────────────────────────────────────

function CreateCategoryDialog() {
  const [open, setOpen] = useState(false)
  const [serverError, setServerError] = useState<string | null>(null)

  const form = useForm<CreateCategoryInput>({
    resolver: zodResolver(createCategorySchema),
    defaultValues: { name: "" },
  })

  async function onSubmit(values: CreateCategoryInput) {
    setServerError(null)
    const fd = new FormData()
    fd.append("name", values.name)
    const result = await createCategory(fd)
    if (result && "error" in result && result.error) {
      setServerError(result.error)
      return
    }
    form.reset()
    setOpen(false)
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button>Create category</Button>} />
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Create category</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Name</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g. Electronics" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            {serverError && (
              <p className="text-sm text-destructive">{serverError}</p>
            )}
            <DialogFooter>
              <DialogClose
                render={
                  <Button type="button" variant="outline">
                    Discard
                  </Button>
                }
              />
              <Button type="submit" disabled={form.formState.isSubmitting}>
                {form.formState.isSubmitting && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                Create category
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}

// ── Edit Category Dialog ────────────────────────────────────────────────────

function EditCategoryDialog({ category }: { category: Category }) {
  const [open, setOpen] = useState(false)
  const [serverError, setServerError] = useState<string | null>(null)

  const form = useForm<UpdateCategoryInput>({
    resolver: zodResolver(updateCategorySchema),
    defaultValues: { id: category.id, name: category.name },
  })

  async function onSubmit(values: UpdateCategoryInput) {
    setServerError(null)
    const fd = new FormData()
    fd.append("id", values.id)
    fd.append("name", values.name)
    const result = await updateCategory(fd)
    if (result && "error" in result && result.error) {
      setServerError(result.error)
      return
    }
    setOpen(false)
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button variant="ghost" size="icon" aria-label="Edit category">
            <Pencil className="h-4 w-4" />
          </Button>
        }
      />
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Edit category</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Name</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g. Electronics" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            {serverError && (
              <p className="text-sm text-destructive">{serverError}</p>
            )}
            <DialogFooter>
              <DialogClose
                render={
                  <Button type="button" variant="outline">
                    Discard changes
                  </Button>
                }
              />
              <Button type="submit" disabled={form.formState.isSubmitting}>
                {form.formState.isSubmitting && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                Save changes
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}

// ── Deactivate Category AlertDialog ────────────────────────────────────────

function DeactivateCategoryDialog({ category }: { category: Category }) {
  const [pending, setPending] = useState(false)
  const [toggleError, setToggleError] = useState<string | null>(null)

  async function handleDeactivate() {
    setPending(true)
    setToggleError(null)
    try {
      const result = await toggleCategoryActive(category.id, false)
      if (result && "error" in result && result.error) {
        setToggleError(result.error)
      }
    } catch {
      setToggleError("Failed to deactivate category. Please try again.")
    } finally {
      setPending(false)
    }
  }

  return (
    <AlertDialog>
      <AlertDialogTrigger
        render={
          <Button
            variant="ghost"
            size="icon"
            aria-label="Deactivate category"
          >
            <EyeOff className="h-4 w-4" />
          </Button>
        }
      />
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Deactivate {category.name}?</AlertDialogTitle>
          <AlertDialogDescription>
            Products in this category will keep their association, but this
            category will no longer appear in the product category dropdown. You
            can reactivate it at any time.
          </AlertDialogDescription>
        </AlertDialogHeader>
        {toggleError && (
          <p className="text-sm text-destructive px-1">{toggleError}</p>
        )}
        <AlertDialogFooter>
          <AlertDialogCancel>Keep active</AlertDialogCancel>
          <AlertDialogAction onClick={handleDeactivate} disabled={pending}>
            {pending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Deactivate category
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

// ── Reactivate Category AlertDialog ────────────────────────────────────────

function ReactivateCategoryDialog({ category }: { category: Category }) {
  const [pending, setPending] = useState(false)
  const [toggleError, setToggleError] = useState<string | null>(null)

  async function handleReactivate() {
    setPending(true)
    setToggleError(null)
    try {
      const result = await toggleCategoryActive(category.id, true)
      if (result && "error" in result && result.error) {
        setToggleError(result.error)
      }
    } catch {
      setToggleError("Failed to reactivate category. Please try again.")
    } finally {
      setPending(false)
    }
  }

  return (
    <AlertDialog>
      <AlertDialogTrigger
        render={
          <Button
            variant="ghost"
            size="icon"
            aria-label="Reactivate category"
          >
            <Eye className="h-4 w-4" />
          </Button>
        }
      />
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Reactivate {category.name}?</AlertDialogTitle>
          <AlertDialogDescription>
            This category will appear again in the product category dropdown.
          </AlertDialogDescription>
        </AlertDialogHeader>
        {toggleError && (
          <p className="text-sm text-destructive px-1">{toggleError}</p>
        )}
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={handleReactivate} disabled={pending}>
            {pending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Reactivate category
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
