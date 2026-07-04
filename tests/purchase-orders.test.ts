/**
 * Purchase order tests — covers PROC-01, PROC-02, PROC-03, PROC-04
 *
 * Implementation notes:
 *   - Unit tests for Zod schema validation (createPurchaseOrderSchema, confirmPurchaseOrderSchema, receivePurchaseOrderSchema)
 *   - Unit tests for assertPOEditable immutability guard
 *   - Integration tests for Server Actions (receivePurchaseOrder, confirmPurchaseOrder) mock
 *     @/lib/prisma, @/lib/auth, and next/cache — no real DB connection needed (WR-08)
 *   - PROC-01/PROC-02: createPurchaseOrderSchema allows 0 line items on Draft save (D-08), rejects invalid line items
 *   - PROC-01: confirmPurchaseOrderSchema requires at least 1 line item at confirm time (D-08)
 *   - PROC-02: receivePurchaseOrderSchema allows receivedQuantity of 0, rejects negative values
 *   - PROC-03/PROC-04: assertPOEditable enforces RECEIVED immutability (D-17)
 *   - PROC-03/PROC-04: updateDraftPurchaseOrder/deletePurchaseOrder reject a RECEIVED PO
 *     via their status-filtered updateMany/deleteMany (D-17, CR-01) with zero writes
 */

import { vi, beforeEach } from "vitest"
import {
  createPurchaseOrderSchema,
  confirmPurchaseOrderSchema,
  receivePurchaseOrderSchema,
  assertPOEditable,
} from "@/lib/validations/purchase-order"

vi.mock("@/lib/auth", () => ({
  auth: vi.fn(),
}))

vi.mock("@/lib/prisma", () => ({
  prisma: {
    $transaction: vi.fn(),
    purchaseOrder: {
      findUnique: vi.fn(),
      update: vi.fn(),
      deleteMany: vi.fn(),
    },
  },
}))

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}))

const { auth } = await import("@/lib/auth")
const { prisma } = await import("@/lib/prisma")
const {
  receivePurchaseOrder,
  confirmPurchaseOrder,
  updateDraftPurchaseOrder,
  deletePurchaseOrder,
} = await import("@/actions/purchase-orders")

describe("Draft Purchase Order Validation — lib/validations/purchase-order.ts", () => {
  // D-08 | Draft POs may be saved with 0 line items
  it("createPurchaseOrderSchema accepts a Draft with 0 line items", () => {
    const result = createPurchaseOrderSchema.safeParse({
      supplierId: "sup_1",
      lineItems: [],
    })
    expect(result.success).toBe(true)
  })

  // PROC-01 | supplierId is required
  it("createPurchaseOrderSchema rejects empty supplierId string", () => {
    const result = createPurchaseOrderSchema.safeParse({
      supplierId: "",
      lineItems: [],
    })
    expect(result.success).toBe(false)
  })

  // PROC-01 | a line item with quantity 0 is invalid
  it("createPurchaseOrderSchema rejects a line item with quantity 0", () => {
    const result = createPurchaseOrderSchema.safeParse({
      supplierId: "sup_1",
      lineItems: [{ productId: "p1", quantity: 0, unitPrice: 10 }],
    })
    expect(result.success).toBe(false)
  })

  // PROC-01 | a line item with a negative unitPrice is invalid
  it("createPurchaseOrderSchema rejects a line item with unitPrice -1", () => {
    const result = createPurchaseOrderSchema.safeParse({
      supplierId: "sup_1",
      lineItems: [{ productId: "p1", quantity: 1, unitPrice: -1 }],
    })
    expect(result.success).toBe(false)
  })
})

describe("Confirm Purchase Order Validation — lib/validations/purchase-order.ts", () => {
  // D-08 | confirming a PO with 0 persisted line items is rejected with the exact UI-SPEC copy
  it("confirmPurchaseOrderSchema rejects 0 line items with the exact error message", () => {
    const result = confirmPurchaseOrderSchema.safeParse({ lineItems: [] })
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues[0].message).toBe(
        "Add at least one line item before confirming this purchase order."
      )
    }
  })

  // D-08 | confirming a PO with at least 1 persisted line item is accepted
  it("confirmPurchaseOrderSchema accepts at least one line item", () => {
    const result = confirmPurchaseOrderSchema.safeParse({
      lineItems: [{ productId: "p1", quantity: 2, unitPrice: 10 }],
    })
    expect(result.success).toBe(true)
  })
})

describe("Receive Purchase Order Validation — lib/validations/purchase-order.ts", () => {
  // RESEARCH.md Open Question 1 | receivedQuantity of 0 is a valid "not delivered" value
  it("receivePurchaseOrderSchema accepts receivedQuantity of 0", () => {
    const result = receivePurchaseOrderSchema.safeParse({
      lineItems: [{ lineItemId: "li_1", receivedQuantity: 0 }],
    })
    expect(result.success).toBe(true)
  })

  it("receivePurchaseOrderSchema rejects a negative receivedQuantity", () => {
    const result = receivePurchaseOrderSchema.safeParse({
      lineItems: [{ lineItemId: "li_1", receivedQuantity: -1 }],
    })
    expect(result.success).toBe(false)
  })
})

describe("Receive Purchase Order Server Action — actions/purchase-orders.ts (WR-08)", () => {
  // Records the order in which mocked tx methods are invoked, so tests can
  // assert the row lock happens strictly before any other read/write.
  let callOrder: string[]

  // Builds a fake `tx` (the callback argument to prisma.$transaction) whose
  // $queryRaw resolves with the given PO status and whose
  // purchaseOrderLineItem.findMany resolves with the given DB line items.
  function makeTx(status: string, dbLineItems: Array<{ id: string; productId: string; quantity: number }>) {
    return {
      $queryRaw: vi.fn(() => {
        callOrder.push("$queryRaw")
        return Promise.resolve([{ status }])
      }),
      purchaseOrderLineItem: {
        findMany: vi.fn(() => {
          callOrder.push("purchaseOrderLineItem.findMany")
          return Promise.resolve(dbLineItems)
        }),
        update: vi.fn(() => {
          callOrder.push("purchaseOrderLineItem.update")
          return Promise.resolve({})
        }),
      },
      product: {
        update: vi.fn(() => {
          callOrder.push("product.update")
          return Promise.resolve({})
        }),
      },
      stockTransaction: {
        create: vi.fn(() => {
          callOrder.push("stockTransaction.create")
          return Promise.resolve({})
        }),
      },
      purchaseOrder: {
        update: vi.fn(() => {
          callOrder.push("purchaseOrder.update")
          return Promise.resolve({})
        }),
      },
    }
  }

  beforeEach(() => {
    callOrder = []
    vi.mocked(auth).mockResolvedValue({ user: { id: "user_1" } } as never)
    vi.mocked(prisma.$transaction).mockReset()
  })

  // 04-04 | mock prisma.$transaction; assert PO row lock acquired via SELECT ... FOR UPDATE before any write
  it("receivePurchaseOrder acquires a PO row lock via SELECT ... FOR UPDATE before any write", async () => {
    const tx = makeTx("ORDERED", [{ id: "li_1", productId: "prod_1", quantity: 5 }])
    vi.mocked(prisma.$transaction).mockImplementation(
      (callback: (tx: any) => Promise<unknown>) => callback(tx)
    )

    const fd = new FormData()
    fd.append(
      "lineItems",
      JSON.stringify([{ lineItemId: "li_1", receivedQuantity: 5 }])
    )
    const result = await receivePurchaseOrder("po_1", fd)

    expect(result).toEqual({ success: true })
    expect(callOrder[0]).toBe("$queryRaw")
    expect(callOrder.indexOf("$queryRaw")).toBeLessThan(
      callOrder.indexOf("product.update")
    )
  })

  // 04-04 | mock prisma.$transaction; call receivePurchaseOrder on a PO whose status is not ORDERED
  // Assert: receivePurchaseOrder returns { error: "This purchase order has already been received." } (D-22 double-receipt race)
  it("receivePurchaseOrder rejects when the PO status is not ORDERED (double-receipt race, D-22)", async () => {
    const tx = makeTx("RECEIVED", [{ id: "li_1", productId: "prod_1", quantity: 5 }])
    vi.mocked(prisma.$transaction).mockImplementation(
      (callback: (tx: any) => Promise<unknown>) => callback(tx)
    )

    const fd = new FormData()
    fd.append(
      "lineItems",
      JSON.stringify([{ lineItemId: "li_1", receivedQuantity: 5 }])
    )
    const result = await receivePurchaseOrder("po_1", fd)

    expect(result).toEqual({
      error: "This purchase order has already been received.",
    })
    expect(tx.product.update).not.toHaveBeenCalled()
  })

  // 04-04 | mock prisma.$transaction; call receivePurchaseOrder with multiple line items
  // Assert: one StockTransaction created per line with reason "Purchase Received" and purchaseOrderId set
  it("receivePurchaseOrder creates one StockTransaction per line with reason 'Purchase Received' and purchaseOrderId set", async () => {
    const dbLineItems = [
      { id: "li_1", productId: "prod_1", quantity: 5 },
      { id: "li_2", productId: "prod_2", quantity: 3 },
    ]
    const tx = makeTx("ORDERED", dbLineItems)
    vi.mocked(prisma.$transaction).mockImplementation(
      (callback: (tx: any) => Promise<unknown>) => callback(tx)
    )

    const fd = new FormData()
    fd.append(
      "lineItems",
      JSON.stringify([
        { lineItemId: "li_1", receivedQuantity: 5 },
        { lineItemId: "li_2", receivedQuantity: 3 },
      ])
    )
    const result = await receivePurchaseOrder("po_1", fd)

    expect(result).toEqual({ success: true })
    expect(tx.stockTransaction.create).toHaveBeenCalledTimes(2)
    expect(tx.stockTransaction.create).toHaveBeenNthCalledWith(1, {
      data: expect.objectContaining({
        reason: "Purchase Received",
        purchaseOrderId: "po_1",
        productId: "prod_1",
        quantity: 5,
      }),
    })
    expect(tx.stockTransaction.create).toHaveBeenNthCalledWith(2, {
      data: expect.objectContaining({
        reason: "Purchase Received",
        purchaseOrderId: "po_1",
        productId: "prod_2",
        quantity: 3,
      }),
    })
  })

  // 04-04 | mock prisma.$transaction; assert tx.product.update called with { increment: receivedQuantity } per line
  it("receivePurchaseOrder increments Product.currentStock per line", async () => {
    const dbLineItems = [{ id: "li_1", productId: "prod_1", quantity: 5 }]
    const tx = makeTx("ORDERED", dbLineItems)
    vi.mocked(prisma.$transaction).mockImplementation(
      (callback: (tx: any) => Promise<unknown>) => callback(tx)
    )

    const fd = new FormData()
    fd.append(
      "lineItems",
      JSON.stringify([{ lineItemId: "li_1", receivedQuantity: 4 }])
    )
    await receivePurchaseOrder("po_1", fd)

    expect(tx.product.update).toHaveBeenCalledWith({
      where: { id: "prod_1" },
      data: { currentStock: { increment: 4 } },
    })
  })

  // 04-04 | mock prisma.$transaction; assert tx.purchaseOrder.update called with status: RECEIVED
  it("receivePurchaseOrder updates purchase order status to RECEIVED", async () => {
    const dbLineItems = [{ id: "li_1", productId: "prod_1", quantity: 5 }]
    const tx = makeTx("ORDERED", dbLineItems)
    vi.mocked(prisma.$transaction).mockImplementation(
      (callback: (tx: any) => Promise<unknown>) => callback(tx)
    )

    const fd = new FormData()
    fd.append(
      "lineItems",
      JSON.stringify([{ lineItemId: "li_1", receivedQuantity: 5 }])
    )
    await receivePurchaseOrder("po_1", fd)

    expect(tx.purchaseOrder.update).toHaveBeenCalledWith({
      where: { id: "po_1" },
      data: { status: "RECEIVED" },
    })
  })

  // WR-03 | mock prisma.$transaction; submit a payload missing one of the PO's line items
  // Assert: receivePurchaseOrder rejects with the exact WR-03 error and makes no stock/StockTransaction mutation
  it("receivePurchaseOrder rejects a payload missing one of the PO's line items (WR-03)", async () => {
    const dbLineItems = [
      { id: "li_1", productId: "prod_1", quantity: 5 },
      { id: "li_2", productId: "prod_2", quantity: 3 },
    ]
    const tx = makeTx("ORDERED", dbLineItems)
    vi.mocked(prisma.$transaction).mockImplementation(
      (callback: (tx: any) => Promise<unknown>) => callback(tx)
    )

    const fd = new FormData()
    fd.append(
      "lineItems",
      JSON.stringify([{ lineItemId: "li_1", receivedQuantity: 5 }])
    )
    const result = await receivePurchaseOrder("po_1", fd)

    expect(result).toEqual({
      error: "All line items must be included when receiving this purchase order.",
    })
    expect(tx.product.update).not.toHaveBeenCalled()
    expect(tx.stockTransaction.create).not.toHaveBeenCalled()
    expect(tx.purchaseOrder.update).not.toHaveBeenCalled()
  })

  // WR-04 | mock prisma.$transaction; submit a receivedQuantity greater than the ordered quantity
  // Assert: receivePurchaseOrder rejects with the exact WR-04 error and makes no stock/StockTransaction mutation
  it("receivePurchaseOrder rejects a receivedQuantity greater than the ordered quantity (WR-04)", async () => {
    const dbLineItems = [{ id: "li_1", productId: "prod_1", quantity: 5 }]
    const tx = makeTx("ORDERED", dbLineItems)
    vi.mocked(prisma.$transaction).mockImplementation(
      (callback: (tx: any) => Promise<unknown>) => callback(tx)
    )

    const fd = new FormData()
    fd.append(
      "lineItems",
      JSON.stringify([{ lineItemId: "li_1", receivedQuantity: 6 }])
    )
    const result = await receivePurchaseOrder("po_1", fd)

    expect(result).toEqual({
      error: "Received quantity cannot exceed the ordered quantity.",
    })
    expect(tx.product.update).not.toHaveBeenCalled()
    expect(tx.stockTransaction.create).not.toHaveBeenCalled()
    expect(tx.purchaseOrder.update).not.toHaveBeenCalled()
  })
})

describe("assertPOEditable immutability guard — lib/validations/purchase-order.ts", () => {
  // D-17 | RECEIVED purchase orders are immutable
  it("assertPOEditable throws when status is immutable RECEIVED", () => {
    expect(() => assertPOEditable("RECEIVED")).toThrow()
  })

  it("assertPOEditable does not throw when status is immutable-safe DRAFT", () => {
    expect(() => assertPOEditable("DRAFT")).not.toThrow()
  })

  it("assertPOEditable does not throw when status is immutable-safe ORDERED", () => {
    expect(() => assertPOEditable("ORDERED")).not.toThrow()
  })
})

describe("Confirm Purchase Order Server Action — actions/purchase-orders.ts (WR-08, D-16)", () => {
  // Builds a fake `tx` (the callback argument to prisma.$transaction) matching
  // confirmPurchaseOrder's row-locked read -> validate -> atomic-write shape.
  function makeConfirmTx(
    status: string,
    po: {
      supplier: { name: string; isActive: boolean }
      lineItems: Array<{
        productId: string
        quantity: number
        unitPrice: { toNumber: () => number }
        product: { name: string; isActive: boolean }
      }>
    },
    updateManyCount = 1
  ) {
    return {
      $queryRaw: vi.fn(() => Promise.resolve([{ status }])),
      purchaseOrder: {
        findUniqueOrThrow: vi.fn(() => Promise.resolve(po)),
        updateMany: vi.fn(() => Promise.resolve({ count: updateManyCount })),
      },
    }
  }

  beforeEach(() => {
    vi.mocked(auth).mockResolvedValue({ user: { id: "user_1" } } as never)
    vi.mocked(prisma.$transaction).mockReset()
  })

  // D-16 | stale-reference re-validation: a deactivated supplier blocks confirmation
  it("confirmPurchaseOrder rejects when the supplier has been deactivated since Draft creation (D-16)", async () => {
    const tx = makeConfirmTx("DRAFT", {
      supplier: { name: "Acme Supplies", isActive: false },
      lineItems: [
        {
          productId: "prod_1",
          quantity: 2,
          unitPrice: { toNumber: () => 10 },
          product: { name: "Widget", isActive: true },
        },
      ],
    })
    vi.mocked(prisma.$transaction).mockImplementation(
      (callback: (tx: any) => Promise<unknown>) => callback(tx)
    )

    const result = await confirmPurchaseOrder("po_1")

    expect(result).toEqual({
      error:
        "Cannot confirm — Acme Supplies has been deactivated. Update this purchase order before confirming.",
    })
    expect(tx.purchaseOrder.updateMany).not.toHaveBeenCalled()
  })

  // D-16 | stale-reference re-validation: a deactivated line-item product blocks confirmation
  it("confirmPurchaseOrder rejects when a line-item product has been deactivated since Draft creation (D-16)", async () => {
    const tx = makeConfirmTx("DRAFT", {
      supplier: { name: "Acme Supplies", isActive: true },
      lineItems: [
        {
          productId: "prod_1",
          quantity: 2,
          unitPrice: { toNumber: () => 10 },
          product: { name: "Widget", isActive: false },
        },
      ],
    })
    vi.mocked(prisma.$transaction).mockImplementation(
      (callback: (tx: any) => Promise<unknown>) => callback(tx)
    )

    const result = await confirmPurchaseOrder("po_1")

    expect(result).toEqual({
      error:
        "Cannot confirm — Widget has been deactivated. Update this purchase order before confirming.",
    })
    expect(tx.purchaseOrder.updateMany).not.toHaveBeenCalled()
  })

  // CR-01 follow-up | the row-locked read confirms status === "DRAFT" but the
  // defense-in-depth updateMany still returns count 0 (e.g. status flipped
  // between the lock and this statement in a way the lock itself couldn't
  // prevent) -> confirmPurchaseOrder must reject, not silently report success
  it("confirmPurchaseOrder rejects when the atomic status-filtered updateMany matches 0 rows", async () => {
    const tx = makeConfirmTx(
      "DRAFT",
      {
        supplier: { name: "Acme Supplies", isActive: true },
        lineItems: [
          {
            productId: "prod_1",
            quantity: 2,
            unitPrice: { toNumber: () => 10 },
            product: { name: "Widget", isActive: true },
          },
        ],
      },
      0
    )
    vi.mocked(prisma.$transaction).mockImplementation(
      (callback: (tx: any) => Promise<unknown>) => callback(tx)
    )

    const result = await confirmPurchaseOrder("po_1")

    expect(result).toEqual({ error: "Only Draft purchase orders can be confirmed." })
  })
})

describe("RECEIVED-PO immutability via direct Server Action calls (D-17, CR-01)", () => {
  beforeEach(() => {
    vi.mocked(auth).mockResolvedValue({ user: { id: "user_1" } } as never)
    vi.mocked(prisma.purchaseOrder.deleteMany).mockReset()
    vi.mocked(prisma.$transaction).mockReset()
  })

  // D-17 | updateDraftPurchaseOrder's status filter matches 0 rows for a RECEIVED PO
  // (its updateMany({ where: { id, status: "DRAFT" } }) excludes it) -> rejected, no write
  it("updateDraftPurchaseOrder rejects a RECEIVED purchase order with no database write", async () => {
    const txUpdateMany = vi.fn(() => Promise.resolve({ count: 0 }))
    const txLineItemDeleteMany = vi.fn()
    const txLineItemCreateMany = vi.fn()
    vi.mocked(prisma.$transaction).mockImplementation(
      (callback: (tx: any) => Promise<unknown>) =>
        callback({
          purchaseOrder: { updateMany: txUpdateMany },
          purchaseOrderLineItem: {
            deleteMany: txLineItemDeleteMany,
            createMany: txLineItemCreateMany,
          },
        })
    )

    const fd = new FormData()
    fd.append("supplierId", "sup_1")
    fd.append("lineItems", JSON.stringify([]))
    const result = await updateDraftPurchaseOrder("po_received", fd)

    expect(result).toEqual({ error: "Only Draft purchase orders can be edited." })
    expect(txUpdateMany).toHaveBeenCalledWith({
      where: { id: "po_received", status: "DRAFT" },
      data: expect.objectContaining({ supplierId: "sup_1" }),
    })
    expect(txLineItemDeleteMany).not.toHaveBeenCalled()
    expect(txLineItemCreateMany).not.toHaveBeenCalled()
  })

  // D-17 | deletePurchaseOrder's deleteMany({ where: { id, status: "DRAFT" } }) matches
  // 0 rows for a RECEIVED PO -> rejected, no write
  it("deletePurchaseOrder rejects a RECEIVED purchase order with no database write", async () => {
    vi.mocked(prisma.purchaseOrder.deleteMany).mockResolvedValue({ count: 0 } as never)

    const result = await deletePurchaseOrder("po_received")

    expect(result).toEqual({ error: "Only Draft purchase orders can be deleted." })
    expect(prisma.purchaseOrder.deleteMany).toHaveBeenCalledWith({
      where: { id: "po_received", status: "DRAFT" },
    })
  })
})
