/**
 * @vitest-environment node
 *
 * Real-Postgres concurrency tests — covers Phase 04 UAT test 4 (CR-01).
 *
 * Unlike tests/purchase-orders.test.ts (mocked prisma/tx), this file does NOT
 * mock @/lib/prisma — it exercises the real Prisma Client against the actual
 * dev Postgres instance (docker container `logistic-postgres`, DATABASE_URL
 * from .env) to prove:
 *   1. The original CR-01 fix (commit a9cb914: updateMany/deleteMany with a
 *      status WHERE filter) genuinely serializes delete-vs-delete and
 *      update-vs-delete races at the database level.
 *   2. A follow-up fix to confirmPurchaseOrder (moving its read + D-08/D-16
 *      validation + write inside one row-locked transaction, discovered
 *      during this UAT session) closes the same class of staleness for
 *      update-vs-confirm — a plain status-filtered updateMany alone does
 *      NOT close this pairing, because updateDraftPurchaseOrder never
 *      touches the `status` column.
 *
 * Only @/lib/auth and next/cache are mocked (session + no-op revalidation) —
 * everything downstream of prisma is real.
 */
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest"

vi.mock("@/lib/auth", () => ({
  auth: vi.fn(),
}))

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}))

const { auth } = await import("@/lib/auth")
const { prisma } = await import("@/lib/prisma")
const { updateDraftPurchaseOrder, confirmPurchaseOrder, deletePurchaseOrder } =
  await import("@/actions/purchase-orders")

const RUN_ID = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`

let categoryId: string
let productId: string
let supplierId: string
let userId: string

async function createDraftPO() {
  const po = await prisma.purchaseOrder.create({
    data: {
      supplierId,
      status: "DRAFT",
      totalAmount: new (await import("@prisma/client")).Prisma.Decimal(20),
      createdById: userId,
      lineItems: {
        create: [{ productId, quantity: 2, unitPrice: 10 }],
      },
    },
  })
  return po.id
}

async function poExists(id: string) {
  return prisma.purchaseOrder.findUnique({ where: { id } })
}

describe("Concurrent Draft PO mutation race — real Postgres (CR-01) [integration]", () => {
  beforeAll(async () => {
    const category = await prisma.category.create({
      data: { name: `concurrency-test-category-${RUN_ID}` },
    })
    categoryId = category.id

    const product = await prisma.product.create({
      data: {
        name: `Concurrency Test Product ${RUN_ID}`,
        sku: `CONC-${RUN_ID}`,
        categoryId,
        currentStock: 0,
      },
    })
    productId = product.id

    const supplier = await prisma.supplier.create({
      data: {
        name: `Concurrency Test Supplier ${RUN_ID}`,
        contactPerson: "Test Contact",
        phone: "000",
        email: `concurrency-${RUN_ID}@example.test`,
        address: "Test Address",
      },
    })
    supplierId = supplier.id

    const user = await prisma.user.create({
      data: {
        email: `concurrency-${RUN_ID}@example.test`,
        name: "Concurrency Test User",
        passwordHash: "not-a-real-hash",
      },
    })
    userId = user.id

    vi.mocked(auth).mockResolvedValue({ user: { id: userId } } as never)
  })

  afterAll(async () => {
    // Cascade removes any surviving PurchaseOrder + PurchaseOrderLineItem rows;
    // remaining fixtures are deleted directly.
    await prisma.purchaseOrder.deleteMany({ where: { createdById: userId } })
    await prisma.product.deleteMany({ where: { id: productId } })
    await prisma.category.deleteMany({ where: { id: categoryId } })
    await prisma.supplier.deleteMany({ where: { id: supplierId } })
    await prisma.user.deleteMany({ where: { id: userId } })
    await prisma.$disconnect()
  })

  afterEach(async () => {
    // Belt-and-suspenders: remove any Draft/Ordered POs a failed assertion left behind.
    await prisma.purchaseOrder.deleteMany({ where: { createdById: userId } })
  })

  it("two concurrent deletePurchaseOrder calls on the same Draft PO: exactly one succeeds, no partial state", async () => {
    const poId = await createDraftPO()

    const [a, b] = await Promise.all([
      deletePurchaseOrder(poId),
      deletePurchaseOrder(poId),
    ])

    const results = [a, b]
    const successes = results.filter((r) => "success" in r && r.success)
    const failures = results.filter((r) => "error" in r)

    expect(successes).toHaveLength(1)
    expect(failures).toHaveLength(1)
    expect(failures[0]).toEqual({ error: "Only Draft purchase orders can be deleted." })

    // No partial state: the PO is fully gone (not half-deleted, no orphaned line items).
    expect(await poExists(poId)).toBeNull()
    const survivingLineItems = await prisma.purchaseOrderLineItem.findMany({
      where: { purchaseOrderId: poId },
    })
    expect(survivingLineItems).toHaveLength(0)
  })

  it("concurrent updateDraftPurchaseOrder + deletePurchaseOrder on the same Draft PO: exactly one succeeds, no partial state", async () => {
    const poId = await createDraftPO()

    const fd = new FormData()
    fd.append("supplierId", supplierId)
    fd.append(
      "lineItems",
      JSON.stringify([{ productId, quantity: 5, unitPrice: 12 }])
    )

    const [updateResult, deleteResult] = await Promise.all([
      updateDraftPurchaseOrder(poId, fd),
      deletePurchaseOrder(poId),
    ])

    const results = [updateResult, deleteResult]
    const successes = results.filter((r) => "success" in r && r.success)
    const failures = results.filter((r) => "error" in r)

    expect(successes).toHaveLength(1)
    expect(failures).toHaveLength(1)

    const finalPO = await poExists(poId)
    if (deleteResult.success) {
      // Delete won: PO fully gone, no orphaned line items.
      expect(finalPO).toBeNull()
      expect(updateResult).toEqual({ error: "Only Draft purchase orders can be edited." })
    } else {
      // Update won: PO survives with the new fields, exactly one line item.
      expect(finalPO).not.toBeNull()
      expect(deleteResult).toEqual({ error: "Only Draft purchase orders can be deleted." })
      const lineItems = await prisma.purchaseOrderLineItem.findMany({
        where: { purchaseOrderId: poId },
      })
      expect(lineItems).toHaveLength(1)
      expect(lineItems[0].quantity).toBe(5)
    }
  })

  it("concurrent updateDraftPurchaseOrder (to a still-valid edit) + confirmPurchaseOrder: both may legitimately succeed sequentially, never a corrupted mix", async () => {
    // Editing (supplierId/lineItems) and confirming (status) touch disjoint
    // columns and aren't mutually exclusive the way delete-vs-anything is —
    // a valid edit landing just before or after a confirm is a legitimate
    // sequential outcome, not a race bug. What must never happen is a
    // partial/inconsistent result (e.g. ORDERED with the wrong line items,
    // or a line-item count mismatch).
    const poId = await createDraftPO()

    const fd = new FormData()
    fd.append("supplierId", supplierId)
    fd.append(
      "lineItems",
      JSON.stringify([{ productId, quantity: 7, unitPrice: 9 }])
    )

    const [updateResult, confirmResult] = await Promise.all([
      updateDraftPurchaseOrder(poId, fd),
      confirmPurchaseOrder(poId),
    ])

    const finalPO = await poExists(poId)
    expect(finalPO).not.toBeNull()
    const lineItems = await prisma.purchaseOrderLineItem.findMany({
      where: { purchaseOrderId: poId },
    })
    expect(lineItems).toHaveLength(1)

    if (updateResult.success && confirmResult.success) {
      // Update landed first (status stayed DRAFT throughout), then confirm's
      // fresh re-read validated the edited (valid) line items and moved it
      // to ORDERED. Both succeeding here is correct, not a bug.
      expect(finalPO?.status).toBe("ORDERED")
      expect(lineItems[0].quantity).toBe(7)
    } else if (confirmResult.success) {
      // Confirm locked first and won; the edit was cleanly rejected because
      // status was already ORDERED by the time its atomic updateMany ran.
      expect(finalPO?.status).toBe("ORDERED")
      expect(lineItems[0].quantity).toBe(2)
      expect(updateResult).toEqual({ error: "Only Draft purchase orders can be edited." })
    } else {
      throw new Error(
        `Unexpected: confirm failed with a valid, still-DRAFT PO: ${JSON.stringify(confirmResult)}`
      )
    }
  })

  it("concurrent updateDraftPurchaseOrder (to 0 line items) + confirmPurchaseOrder: confirm never confirms against stale (pre-edit) line items — D-08 closed", async () => {
    // This is the scenario the CR-01-style updateMany fix alone does NOT
    // close: updateDraftPurchaseOrder never touches `status`, so a plain
    // status-filtered write on confirmPurchaseOrder can still succeed using
    // a stale pre-edit read. The real fix moves confirm's read + D-08/D-16
    // validation + write inside one row-locked transaction so it always
    // validates the CURRENT line items, whichever operation actually wins.
    const poId = await createDraftPO()

    const fd = new FormData()
    fd.append("supplierId", supplierId)
    fd.append("lineItems", JSON.stringify([])) // valid on a Draft (D-08 allows 0 on save)

    const [updateResult, confirmResult] = await Promise.all([
      updateDraftPurchaseOrder(poId, fd),
      confirmPurchaseOrder(poId),
    ])

    const results = [updateResult, confirmResult]
    const successes = results.filter((r) => "success" in r && r.success)
    expect(successes).toHaveLength(1)

    const finalPO = await poExists(poId)
    expect(finalPO).not.toBeNull()
    const lineItems = await prisma.purchaseOrderLineItem.findMany({
      where: { purchaseOrderId: poId },
    })

    // The invariant that actually matters: never end up ORDERED with 0 line
    // items, regardless of which operation happened to win the race.
    if (finalPO?.status === "ORDERED") {
      expect(lineItems.length).toBeGreaterThan(0)
      expect(updateResult).toEqual({ error: "Only Draft purchase orders can be edited." })
    } else {
      expect(finalPO?.status).toBe("DRAFT")
      expect(lineItems).toHaveLength(0)
      expect(confirmResult).toEqual({
        error: "Add at least one line item before confirming this purchase order.",
      })
    }
  })
})
