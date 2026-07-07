/**
 * Reports page tests — covers REPT-01, REPT-02, REPT-03
 *
 * Implementation notes:
 *   - Uses vi.mock("@/lib/prisma", ...) / dynamic-import-after-mock convention
 *     established in tests/purchase-orders.test.ts / tests/products.test.ts —
 *     no real DB connection needed.
 *   - REPT-01 (Task 1): resolveReportType whitelist/fallback + inventory tab
 *     query-shape / only-one-query-runs assertions.
 *   - REPT-02 (Task 2): resolveDateRange / groupTransactionsByProduct pure-function
 *     tests + movements tab query-shape assertions, closing T-03-11 for this surface.
 *   - REPT-03 (Task 3): purchase-orders tab query-shape (no status filter) +
 *     Decimal -> number serialization assertions.
 */

import { vi } from "vitest"
import {
  resolveReportType,
  resolveDateRange,
  groupTransactionsByProduct,
} from "@/lib/utils/reports"

vi.mock("@/lib/prisma", () => ({
  prisma: {
    product: { findMany: vi.fn() },
    stockTransaction: { findMany: vi.fn() },
    purchaseOrder: { findMany: vi.fn() },
  },
}))

const { prisma } = await import("@/lib/prisma")
const ReportsPage = (await import("@/app/(protected)/reports/page")).default

const mockProduct = {
  id: "prod_1",
  name: "Widget",
  sku: "SKU-001",
  category: { name: "Widgets" },
  reorderThreshold: 10,
  currentStock: 5,
  isActive: true,
}

// ReportsPage returns <div><h1/><Suspense><ReportsClient .../></Suspense></div> —
// drill through the Suspense wrapper to reach ReportsClient's actual props.
function reportsClientProps(element: { props: { children: unknown[] } }) {
  const suspenseElement = element.props.children[1] as {
    props: { children: { props: Record<string, unknown> } }
  }
  return suspenseElement.props.children.props
}

describe("resolveReportType — lib/utils/reports.ts (D-02)", () => {
  it('resolves the exact literal "inventory" to itself', () => {
    expect(resolveReportType("inventory")).toBe("inventory")
  })

  it('resolves the exact literal "movements" to itself', () => {
    expect(resolveReportType("movements")).toBe("movements")
  })

  it('resolves the exact literal "purchase-orders" to itself', () => {
    expect(resolveReportType("purchase-orders")).toBe("purchase-orders")
  })

  it('resolves an unrelated/garbage value to "inventory"', () => {
    expect(resolveReportType("bogus-value")).toBe("inventory")
  })

  it('resolves wrong-case input to "inventory" (case-sensitive match)', () => {
    expect(resolveReportType("Inventory")).toBe("inventory")
  })

  it('resolves undefined/absent to "inventory", never throwing', () => {
    expect(resolveReportType(undefined)).toBe("inventory")
  })
})

describe("ReportsPage — inventory tab (REPT-01)", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(prisma.product.findMany).mockResolvedValue([mockProduct] as never)
    vi.mocked(prisma.stockTransaction.findMany).mockResolvedValue([] as never)
    vi.mocked(prisma.purchaseOrder.findMany).mockResolvedValue([] as never)
  })

  it("calls prisma.product.findMany exactly once with no isActive filter, and does not call stockTransaction/purchaseOrder findMany", async () => {
    await ReportsPage({
      searchParams: Promise.resolve({ type: "inventory" }),
    } as never)

    expect(prisma.product.findMany).toHaveBeenCalledTimes(1)
    const call = vi.mocked(prisma.product.findMany).mock.calls[0][0] as {
      where?: unknown
    }
    expect(call?.where).toBeUndefined()
    expect(prisma.stockTransaction.findMany).not.toHaveBeenCalled()
    expect(prisma.purchaseOrder.findMany).not.toHaveBeenCalled()
  })

  it('resolves props.activeType to "inventory" for a bogus ?type= value, never throwing', async () => {
    const element = await ReportsPage({
      searchParams: Promise.resolve({ type: "bogus" }),
    } as never)

    expect(reportsClientProps(element as never).activeType).toBe("inventory")
  })

  it('resolves props.activeType to "inventory" for an absent ?type= value, never throwing', async () => {
    const element = await ReportsPage({
      searchParams: Promise.resolve({}),
    } as never)

    expect(reportsClientProps(element as never).activeType).toBe("inventory")
  })

  it("returns props.inventoryRows as flattened plain objects (category name flattened, no raw Prisma instances)", async () => {
    const element = await ReportsPage({
      searchParams: Promise.resolve({ type: "inventory" }),
    } as never)

    expect(reportsClientProps(element as never).inventoryRows).toEqual([
      {
        id: "prod_1",
        name: "Widget",
        sku: "SKU-001",
        categoryName: "Widgets",
        reorderThreshold: 10,
        currentStock: 5,
        isActive: true,
      },
    ])
  })
})

describe("resolveDateRange — lib/utils/reports.ts (D-07/D-08, closes T-03-11)", () => {
  it("returns a gte/lte pair matching the given valid from/to dates", () => {
    const { gte, lte } = resolveDateRange("2026-01-01", "2026-01-31")
    expect(gte.toISOString().startsWith("2026-01-01")).toBe(true)
    expect(lte.toISOString().startsWith("2026-01-31")).toBe(true)
  })

  it("falls back to the 30-day default for malformed from/to values, never throwing", () => {
    const now = Date.now()
    const { gte, lte } = resolveDateRange("garbage", "also-bad")
    const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000
    expect(Math.abs(now - thirtyDaysMs - gte.getTime())).toBeLessThan(5000)
    expect(Math.abs(now - lte.getTime())).toBeLessThan(5000)
  })

  it("falls back to the 30-day default for a wrong-shaped date (slashes), never throwing", () => {
    expect(() => resolveDateRange("2026/07/07", undefined)).not.toThrow()
    const { gte, lte } = resolveDateRange("2026/07/07", undefined)
    expect(Number.isNaN(gte.getTime())).toBe(false)
    expect(Number.isNaN(lte.getTime())).toBe(false)
  })
})

describe("groupTransactionsByProduct — lib/utils/reports.ts (D-09)", () => {
  it("groups an already product-ordered transaction list into one group per product, preserving first-seen order", () => {
    const transactions = [
      {
        id: "tx_1",
        type: "STOCK_IN" as const,
        quantity: 5,
        reason: "Purchase Received",
        notes: null,
        createdAt: new Date("2026-01-02"),
        product: { id: "prod_a", name: "Product A", sku: "SKU-A" },
        createdBy: { name: "Alice" },
      },
      {
        id: "tx_2",
        type: "STOCK_OUT" as const,
        quantity: 2,
        reason: "Sale",
        notes: null,
        createdAt: new Date("2026-01-01"),
        product: { id: "prod_a", name: "Product A", sku: "SKU-A" },
        createdBy: { name: "Alice" },
      },
      {
        id: "tx_3",
        type: "STOCK_IN" as const,
        quantity: 3,
        reason: "Purchase Received",
        notes: null,
        createdAt: new Date("2026-01-01"),
        product: { id: "prod_b", name: "Product B", sku: "SKU-B" },
        createdBy: { name: "Bob" },
      },
    ]

    const groups = groupTransactionsByProduct(transactions)

    expect(groups).toHaveLength(2)
    expect(groups[0].transactions).toHaveLength(2)
    expect(groups[1].transactions).toHaveLength(1)
  })
})

describe("ReportsPage — movements tab (REPT-02, closes T-03-11)", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(prisma.product.findMany).mockResolvedValue([mockProduct] as never)
    vi.mocked(prisma.stockTransaction.findMany).mockResolvedValue([] as never)
    vi.mocked(prisma.purchaseOrder.findMany).mockResolvedValue([] as never)
  })

  it("does not throw for malformed from/to, and the captured where.createdAt.gte/lte are valid Dates", async () => {
    await ReportsPage({
      searchParams: Promise.resolve({
        type: "movements",
        from: "not-a-date",
        to: "also-bad",
      }),
    } as never)

    const call = vi.mocked(prisma.stockTransaction.findMany).mock.calls[0][0] as {
      where: { createdAt: { gte: Date; lte: Date } }
    }
    expect(Number.isNaN(call.where.createdAt.gte.getTime())).toBe(false)
    expect(Number.isNaN(call.where.createdAt.lte.getTime())).toBe(false)
  })

  it("calls prisma.stockTransaction.findMany exactly once, and does not call product/purchaseOrder findMany", async () => {
    await ReportsPage({
      searchParams: Promise.resolve({ type: "movements" }),
    } as never)

    expect(prisma.stockTransaction.findMany).toHaveBeenCalledTimes(1)
    expect(prisma.product.findMany).not.toHaveBeenCalled()
    expect(prisma.purchaseOrder.findMany).not.toHaveBeenCalled()
  })

  it('does NOT call prisma.stockTransaction.findMany when type is "inventory"', async () => {
    await ReportsPage({
      searchParams: Promise.resolve({ type: "inventory" }),
    } as never)

    expect(prisma.stockTransaction.findMany).not.toHaveBeenCalled()
  })
})

describe("ReportsPage — purchase-orders tab (REPT-03)", () => {
  const mockPO = {
    id: "po_1",
    poNumber: 1,
    status: "DRAFT",
    totalAmount: { toNumber: () => 150000 },
    createdAt: new Date("2026-01-01"),
    supplier: { name: "Acme Supplies" },
    createdBy: { name: "Alice" },
  }

  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(prisma.product.findMany).mockResolvedValue([mockProduct] as never)
    vi.mocked(prisma.stockTransaction.findMany).mockResolvedValue([] as never)
    vi.mocked(prisma.purchaseOrder.findMany).mockResolvedValue([mockPO] as never)
  })

  it("calls prisma.purchaseOrder.findMany exactly once with no status key in where, and does not call product/stockTransaction findMany", async () => {
    await ReportsPage({
      searchParams: Promise.resolve({ type: "purchase-orders" }),
    } as never)

    expect(prisma.purchaseOrder.findMany).toHaveBeenCalledTimes(1)
    const call = vi.mocked(prisma.purchaseOrder.findMany).mock.calls[0][0] as {
      where?: Record<string, unknown>
    }
    expect(call?.where?.status).toBeUndefined()
    expect(prisma.product.findMany).not.toHaveBeenCalled()
    expect(prisma.stockTransaction.findMany).not.toHaveBeenCalled()
  })

  it("returns props.purchaseOrderRows[].totalAmount as a plain number (Decimal.toNumber() result)", async () => {
    const element = await ReportsPage({
      searchParams: Promise.resolve({ type: "purchase-orders" }),
    } as never)

    const rows = reportsClientProps(element as never)
      .purchaseOrderRows as Array<{ totalAmount: unknown }>
    expect(typeof rows[0].totalAmount).toBe("number")
    expect(rows[0].totalAmount).toBe(150000)
  })
})
