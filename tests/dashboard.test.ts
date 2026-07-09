/**
 * Dashboard tests — covers DASH-01, DASH-02, DASH-03
 *
 * Implementation notes:
 *   - Unit tests for pure dashboard helper functions (lib/utils/dashboard.ts)
 *   - Uses Vitest's built-in fake timer API (vi.setSystemTime) to freeze "now"
 *     for deterministic UTC day-boundary assertions
 *   - No @prisma/client imports — helper tests are pure logic, no DB connection needed
 */

import { getTodayUtcRange, fillPoStatusCounts } from "@/lib/utils/dashboard"

vi.mock("@/lib/prisma", () => ({
  prisma: {
    product: {
      count: vi.fn(),
      fields: { reorderThreshold: "REORDER_THRESHOLD_FIELDREF" },
      findMany: vi.fn(),
    },
    supplier: { count: vi.fn() },
    stockTransaction: { count: vi.fn(), groupBy: vi.fn() },
    purchaseOrder: { groupBy: vi.fn() },
  },
}))

const { prisma } = await import("@/lib/prisma")
const DashboardPage = (await import("@/app/(protected)/dashboard/page")).default

describe("getTodayUtcRange — lib/utils/dashboard.ts (UTC day boundary)", () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  // DASH-01 | D-10: mid-day UTC timestamp resolves to that day's UTC boundaries
  it("with system time frozen at 2026-07-06T15:30:00.000Z, returns UTC day boundaries for 2026-07-06", () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date("2026-07-06T15:30:00.000Z"))

    const { start, end } = getTodayUtcRange()

    expect(start.toISOString()).toBe("2026-07-06T00:00:00.000Z")
    expect(end.toISOString()).toBe("2026-07-06T23:59:59.999Z")
  })

  // DASH-01 | D-10: UTC day boundary edge case — just after midnight UTC
  it("with system time frozen at 2026-01-01T00:00:00.500Z (UTC day boundary edge case), still returns that same UTC date's boundaries", () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date("2026-01-01T00:00:00.500Z"))

    const { start, end } = getTodayUtcRange()

    expect(start.toISOString()).toBe("2026-01-01T00:00:00.000Z")
    expect(end.toISOString()).toBe("2026-01-01T23:59:59.999Z")
  })
})

describe("fillPoStatusCounts — lib/utils/dashboard.ts (groupBy zero-fill)", () => {
  // DASH-03 | D-11: empty groupBy result defaults all three statuses to 0
  it("fillPoStatusCounts([]) returns { DRAFT: 0, ORDERED: 0, RECEIVED: 0 }", () => {
    const result = fillPoStatusCounts([])
    expect(result).toEqual({ DRAFT: 0, ORDERED: 0, RECEIVED: 0 })
  })

  // DASH-03 | D-11: missing ORDERED group defaults to 0, matching Prisma's groupBy
  // behavior of omitting zero-count groups
  it("fillPoStatusCounts with DRAFT and RECEIVED groups defaults missing ORDERED to 0", () => {
    const result = fillPoStatusCounts([
      { status: "DRAFT", _count: { status: 3 } },
      { status: "RECEIVED", _count: { status: 1 } },
    ])
    expect(result).toEqual({ DRAFT: 3, ORDERED: 0, RECEIVED: 1 })
  })
})

describe("DashboardPage — app/(protected)/dashboard/page.tsx (KPI query shapes)", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Defaults keep the 3 pre-existing tests passing unmodified: an empty
    // topSellingProducts pipeline never calls .map() on undefined.
    vi.mocked(prisma.stockTransaction.groupBy).mockResolvedValue([] as never)
    vi.mocked(prisma.product.findMany).mockResolvedValue([] as never)
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  // DASH-01: 5 parallel Prisma queries produce the expected element props
  it("returns props matching the 4 mocked count values and fillPoStatusCounts(groupBy result)", async () => {
    vi.mocked(prisma.product.count).mockResolvedValue(42)
    vi.mocked(prisma.supplier.count).mockResolvedValue(7)
    vi.mocked(prisma.stockTransaction.count).mockResolvedValue(13)
    vi.mocked(prisma.purchaseOrder.groupBy).mockResolvedValue([
      { status: "DRAFT", _count: { status: 2 } },
    ] as never)

    // product.count is called twice (totalProducts, lowStockCount) — differentiate by args shape
    vi.mocked(prisma.product.count).mockImplementation((args?: unknown) => {
      const where = (args as { where?: { currentStock?: unknown } })?.where
      if (where?.currentStock) return Promise.resolve(5) as never
      return Promise.resolve(42) as never
    })

    const element = await DashboardPage()

    expect(element.props.totalProducts).toBe(42)
    expect(element.props.totalSuppliers).toBe(7)
    expect(element.props.movementsToday).toBe(13)
    expect(element.props.lowStockCount).toBe(5)
    expect(element.props.poStatusCounts).toEqual({ DRAFT: 2, ORDERED: 0, RECEIVED: 0 })
  })

  // DASH-02: low-stock count query uses the FieldRef cross-column comparison
  it("calls prisma.product.count with the reorderThreshold FieldRef for the low-stock count", async () => {
    vi.mocked(prisma.product.count).mockResolvedValue(0)
    vi.mocked(prisma.supplier.count).mockResolvedValue(0)
    vi.mocked(prisma.stockTransaction.count).mockResolvedValue(0)
    vi.mocked(prisma.purchaseOrder.groupBy).mockResolvedValue([] as never)

    await DashboardPage()

    const calls = vi.mocked(prisma.product.count).mock.calls
    const lowStockCall = calls.find(
      (call) => (call[0] as { where?: { currentStock?: unknown } })?.where?.currentStock
    )
    expect(lowStockCall).toBeDefined()
    expect(lowStockCall?.[0]).toMatchObject({
      where: {
        isActive: true,
        currentStock: { lte: "REORDER_THRESHOLD_FIELDREF" },
      },
    })
  })

  // DASH-01 | D-10: stockTransaction.count's createdAt.gte/lte match getTodayUtcRange()'s boundaries
  it("calls stockTransaction.count with today's UTC day-boundary Date instances", async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date("2026-07-06T15:30:00.000Z"))

    vi.mocked(prisma.product.count).mockResolvedValue(0)
    vi.mocked(prisma.supplier.count).mockResolvedValue(0)
    vi.mocked(prisma.stockTransaction.count).mockResolvedValue(0)
    vi.mocked(prisma.purchaseOrder.groupBy).mockResolvedValue([] as never)

    await DashboardPage()

    const call = vi.mocked(prisma.stockTransaction.count).mock.calls[0][0] as {
      where: { createdAt: { gte: Date; lte: Date } }
    }
    expect(call.where.createdAt.gte.toISOString()).toBe("2026-07-06T00:00:00.000Z")
    expect(call.where.createdAt.lte.toISOString()).toBe("2026-07-06T23:59:59.999Z")
  })

  // Top Selling Products: groupBy(STOCK_OUT, by productId) mapped through a
  // product.findMany name lookup, order preserved, names correctly joined.
  it("maps stockTransaction.groupBy + product.findMany into topSellingProducts", async () => {
    vi.mocked(prisma.product.count).mockResolvedValue(0)
    vi.mocked(prisma.supplier.count).mockResolvedValue(0)
    vi.mocked(prisma.stockTransaction.count).mockResolvedValue(0)
    vi.mocked(prisma.purchaseOrder.groupBy).mockResolvedValue([] as never)
    vi.mocked(prisma.stockTransaction.groupBy).mockResolvedValue([
      { productId: "p1", _sum: { quantity: 50 } },
      { productId: "p2", _sum: { quantity: 30 } },
    ] as never)
    vi.mocked(prisma.product.findMany).mockResolvedValue([
      { id: "p1", name: "Product One" },
      { id: "p2", name: "Product Two" },
    ] as never)

    const element = await DashboardPage()

    expect(element.props.topSellingProducts).toEqual([
      { productId: "p1", name: "Product One", totalSold: 50 },
      { productId: "p2", name: "Product Two", totalSold: 30 },
    ])
  })
})
