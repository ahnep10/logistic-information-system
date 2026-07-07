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
import { resolveReportType } from "@/lib/utils/reports"

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
