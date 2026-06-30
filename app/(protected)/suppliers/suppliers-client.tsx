"use client"

import { useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { Pencil, EyeOff, Eye, Loader2, Truck } from "lucide-react"

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
import { Textarea } from "@/components/ui/textarea"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"

import {
  createSupplierSchema,
  updateSupplierSchema,
  type CreateSupplierInput,
  type UpdateSupplierInput,
} from "@/lib/validations/supplier"
import {
  createSupplier,
  updateSupplier,
  toggleSupplierActive,
} from "@/actions/suppliers"

interface Supplier {
  id: string
  name: string
  contactPerson: string
  phone: string
  email: string
  address: string
  isActive: boolean
}

interface SuppliersClientProps {
  suppliers: Supplier[]
  isManager: boolean
}

type FilterTab = "all" | "active" | "inactive"

export default function SuppliersClient({ suppliers, isManager }: SuppliersClientProps) {
  const [filter, setFilter] = useState<FilterTab>("all")

  const visibleSuppliers = suppliers.filter((s) => {
    if (filter === "active") return s.isActive
    if (filter === "inactive") return !s.isActive
    return true
  })

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold">Suppliers</h1>
        {isManager && <CreateSupplierDialog />}
      </div>

      <Tabs
        value={filter}
        onValueChange={(v) => setFilter(v as FilterTab)}
        className="mb-4"
      >
        <TabsList>
          <TabsTrigger value="all">All</TabsTrigger>
          <TabsTrigger value="active">Active</TabsTrigger>
          <TabsTrigger value="inactive">Inactive</TabsTrigger>
        </TabsList>
      </Tabs>

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead style={{ width: 160 }}>Contact Person</TableHead>
              <TableHead style={{ width: 130 }}>Phone</TableHead>
              <TableHead>Email</TableHead>
              <TableHead style={{ width: 100 }}>Status</TableHead>
              {isManager && (
                <TableHead style={{ width: 80 }} className="text-right">
                  Actions
                </TableHead>
              )}
            </TableRow>
          </TableHeader>
          <TableBody>
            {visibleSuppliers.length === 0 ? (
              <TableRow>
                <TableCell colSpan={isManager ? 6 : 5}>
                  <div className="flex flex-col items-center py-12 text-center">
                    <Truck className="w-8 h-8 text-zinc-300 mb-3" />
                    {filter === "all" && (
                      <>
                        <p className="text-sm font-medium text-zinc-900">No suppliers yet</p>
                        <p className="text-sm text-zinc-500 mt-1">
                          Create a supplier to link purchase orders.
                        </p>
                      </>
                    )}
                    {filter === "active" && (
                      <>
                        <p className="text-sm font-medium text-zinc-900">No active suppliers</p>
                        <p className="text-sm text-zinc-500 mt-1">
                          All suppliers are currently deactivated.
                        </p>
                      </>
                    )}
                    {filter === "inactive" && (
                      <>
                        <p className="text-sm font-medium text-zinc-900">No inactive suppliers</p>
                        <p className="text-sm text-zinc-500 mt-1">
                          All suppliers are currently active.
                        </p>
                      </>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              visibleSuppliers.map((supplier) => (
                <TableRow key={supplier.id}>
                  <TableCell className="text-sm font-medium">{supplier.name}</TableCell>
                  <TableCell className="text-sm">{supplier.contactPerson}</TableCell>
                  <TableCell className="text-sm text-zinc-500">{supplier.phone}</TableCell>
                  <TableCell className="text-sm text-zinc-500">{supplier.email}</TableCell>
                  <TableCell>
                    <Badge variant={supplier.isActive ? "default" : "secondary"}>
                      {supplier.isActive ? "Active" : "Inactive"}
                    </Badge>
                  </TableCell>
                  {isManager && (
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <EditSupplierDialog supplier={supplier} />
                        {supplier.isActive ? (
                          <DeactivateSupplierDialog supplier={supplier} />
                        ) : (
                          <ReactivateSupplierDialog supplier={supplier} />
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

// ── Create Supplier Dialog ──────────────────────────────────────────────────

function CreateSupplierDialog() {
  const [open, setOpen] = useState(false)
  const [serverError, setServerError] = useState<string | null>(null)

  const form = useForm<CreateSupplierInput>({
    resolver: zodResolver(createSupplierSchema),
    defaultValues: { name: "", contactPerson: "", phone: "", email: "", address: "" },
  })

  async function onSubmit(values: CreateSupplierInput) {
    setServerError(null)
    const fd = new FormData()
    Object.entries(values).forEach(([k, v]) => fd.append(k, String(v)))
    const result = await createSupplier(fd)
    if (result?.error) {
      setServerError(typeof result.error === "string" ? result.error : "An error occurred.")
      return
    }
    form.reset()
    setOpen(false)
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button>Create supplier</Button>} />
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Create supplier</DialogTitle>
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
                    <Input placeholder="Supplier company name" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="contactPerson"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Contact person</FormLabel>
                  <FormControl>
                    <Input placeholder="Full name" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="phone"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Phone</FormLabel>
                  <FormControl>
                    <Input type="tel" placeholder="+62 21 1234 5678" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Email</FormLabel>
                  <FormControl>
                    <Input type="email" placeholder="contact@supplier.com" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="address"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Address</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Street address, city, postal code"
                      rows={3}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            {serverError && (
              <p className="text-sm text-destructive">{serverError}</p>
            )}
            <DialogFooter>
              <DialogClose render={<Button type="button" variant="outline">Discard</Button>} />
              <Button type="submit" disabled={form.formState.isSubmitting}>
                {form.formState.isSubmitting && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                Create supplier
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}

// ── Edit Supplier Dialog ────────────────────────────────────────────────────

function EditSupplierDialog({ supplier }: { supplier: Supplier }) {
  const [open, setOpen] = useState(false)
  const [serverError, setServerError] = useState<string | null>(null)

  const form = useForm<UpdateSupplierInput>({
    resolver: zodResolver(updateSupplierSchema),
    defaultValues: {
      id: supplier.id,
      name: supplier.name,
      contactPerson: supplier.contactPerson,
      phone: supplier.phone,
      email: supplier.email,
      address: supplier.address,
    },
  })

  async function onSubmit(values: UpdateSupplierInput) {
    setServerError(null)
    const fd = new FormData()
    fd.append("id", values.id)
    fd.append("name", values.name)
    fd.append("contactPerson", values.contactPerson)
    fd.append("phone", values.phone)
    fd.append("email", values.email)
    fd.append("address", values.address)
    const result = await updateSupplier(fd)
    if (result?.error) {
      setServerError(typeof result.error === "string" ? result.error : "An error occurred.")
      return
    }
    setOpen(false)
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button variant="ghost" size="icon" aria-label="Edit supplier">
            <Pencil className="h-4 w-4" />
          </Button>
        }
      />
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Edit supplier</DialogTitle>
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
                    <Input placeholder="Supplier company name" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="contactPerson"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Contact person</FormLabel>
                  <FormControl>
                    <Input placeholder="Full name" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="phone"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Phone</FormLabel>
                  <FormControl>
                    <Input type="tel" placeholder="+62 21 1234 5678" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Email</FormLabel>
                  <FormControl>
                    <Input type="email" placeholder="contact@supplier.com" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="address"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Address</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Street address, city, postal code"
                      rows={3}
                      {...field}
                    />
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
                  <Button type="button" variant="outline">Discard changes</Button>
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

// ── Deactivate Supplier AlertDialog ─────────────────────────────────────────

function DeactivateSupplierDialog({ supplier }: { supplier: Supplier }) {
  const [pending, setPending] = useState(false)
  const [toggleError, setToggleError] = useState<string | null>(null)

  async function handleDeactivate() {
    setPending(true)
    setToggleError(null)
    try {
      const result = await toggleSupplierActive(supplier.id, false)
      if (result?.error) {
        setToggleError(result.error)
      }
    } catch {
      setToggleError("Failed to deactivate supplier. Please try again.")
    } finally {
      setPending(false)
    }
  }

  return (
    <AlertDialog>
      <AlertDialogTrigger
        render={
          <Button variant="ghost" size="icon" aria-label="Deactivate supplier">
            <EyeOff className="h-4 w-4" />
          </Button>
        }
      />
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Deactivate {supplier.name}?</AlertDialogTitle>
          <AlertDialogDescription>
            This supplier will no longer appear in purchase order forms. All existing
            purchase order history is preserved. You can reactivate them at any time.
          </AlertDialogDescription>
        </AlertDialogHeader>
        {toggleError && (
          <p className="text-sm text-destructive px-1">{toggleError}</p>
        )}
        <AlertDialogFooter>
          <AlertDialogCancel>Keep active</AlertDialogCancel>
          <AlertDialogAction onClick={handleDeactivate} disabled={pending}>
            {pending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Deactivate supplier
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

// ── Reactivate Supplier AlertDialog ─────────────────────────────────────────

function ReactivateSupplierDialog({ supplier }: { supplier: Supplier }) {
  const [pending, setPending] = useState(false)
  const [toggleError, setToggleError] = useState<string | null>(null)

  async function handleReactivate() {
    setPending(true)
    setToggleError(null)
    try {
      const result = await toggleSupplierActive(supplier.id, true)
      if (result?.error) {
        setToggleError(result.error)
      }
    } catch {
      setToggleError("Failed to reactivate supplier. Please try again.")
    } finally {
      setPending(false)
    }
  }

  return (
    <AlertDialog>
      <AlertDialogTrigger
        render={
          <Button variant="ghost" size="icon" aria-label="Reactivate supplier">
            <Eye className="h-4 w-4" />
          </Button>
        }
      />
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Reactivate {supplier.name}?</AlertDialogTitle>
          <AlertDialogDescription>
            This supplier will appear again in purchase order forms.
          </AlertDialogDescription>
        </AlertDialogHeader>
        {toggleError && (
          <p className="text-sm text-destructive px-1">{toggleError}</p>
        )}
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={handleReactivate} disabled={pending}>
            {pending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Reactivate supplier
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
