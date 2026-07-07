/**
 * Reports export tests — covers REPT-04
 *
 * Implementation notes:
 *   - Uses vi.mock("@/lib/auth", ...) / vi.mock("@/lib/prisma", ...) /
 *     dynamic-import-after-mock convention established in
 *     tests/purchase-orders.test.ts.
 *   - A genuinely new test pattern for this codebase: calls each Route
 *     Handler's exported GET() function directly with a plain Request,
 *     inspecting the returned Response's status/headers/body instead of
 *     rendering a React component.
 *   - Task 1: requireManagerResponse() gate + inventory/movements handlers.
 *   - Task 2: purchase-orders handler + full 3-handler auth-gate coverage.
 */

import { vi } from "vitest"

vi.mock("@/lib/auth", () => ({
  auth: vi.fn(),
}))

vi.mock("@/lib/prisma", () => ({
  prisma: {
    product: { findMany: vi.fn() },
    stockTransaction: { findMany: vi.fn() },
    purchaseOrder: { findMany: vi.fn() },
  },
}))

const { auth } = await import("@/lib/auth")
const { prisma } = await import("@/lib/prisma")
const { requireManagerResponse } = await import("@/lib/utils/route-auth")
const { GET: inventoryGET } = await import("@/app/api/reports/inventory/route")
const { GET: movementsGET } = await import("@/app/api/reports/movements/route")
const { GET: purchaseOrdersGET } = await import(
  "@/app/api/reports/purchase-orders/route"
)

const mockManagerSession = {
  user: { id: "u1", name: "Manager One", role: "MANAGER" as const },
}
const mockStaffSession = {
  user: { id: "u2", name: "Staff One", role: "STAFF" as const },
}

const mockProduct = {
  id: "prod_1",
  name: "Widget",
  sku: "SKU-001",
  category: { name: "Widgets" },
  reorderThreshold: 10,
  currentStock: 5,
  isActive: true,
}

const mockTransaction = {
  id: "tx_1",
  type: "STOCK_IN",
  quantity: 20,
  reason: "Purchase Received",
  createdAt: new Date("2026-07-01T00:00:00.000Z"),
  product: { name: "Widget", sku: "SKU-001" },
  createdBy: { name: "Manager One" },
}

const mockPurchaseOrder = {
  id: "po_1",
  poNumber: 7,
  status: "ORDERED",
  totalAmount: { toNumber: () => 199.99 },
  createdAt: new Date("2026-07-01T00:00:00.000Z"),
  supplier: { name: "Acme Supplies" },
  createdBy: { name: "Manager One" },
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe("requireManagerResponse — lib/utils/route-auth.ts", () => {
  it("returns a 401 Response when auth() resolves null", async () => {
    vi.mocked(auth).mockResolvedValue(null as never)
    const result = await requireManagerResponse()
    expect(result).not.toBeNull()
    expect((result as Response).status).toBe(401)
  })

  it("returns a 403 Response when the session's role is not MANAGER", async () => {
    vi.mocked(auth).mockResolvedValue(mockStaffSession as never)
    const result = await requireManagerResponse()
    expect(result).not.toBeNull()
    expect((result as Response).status).toBe(403)
  })

  it("returns null when the session's role is MANAGER", async () => {
    vi.mocked(auth).mockResolvedValue(mockManagerSession as never)
    const result = await requireManagerResponse()
    expect(result).toBeNull()
  })
})

describe("GET /api/reports/inventory (REPT-04)", () => {
  it("returns 401 with no mocked session and never calls prisma.product.findMany", async () => {
    vi.mocked(auth).mockResolvedValue(null as never)
    const response = await inventoryGET(
      new Request("http://localhost/api/reports/inventory")
    )
    expect(response.status).toBe(401)
    expect(prisma.product.findMany).not.toHaveBeenCalled()
  })

  it("returns a real .xlsx buffer with correct headers for a MANAGER session", async () => {
    vi.mocked(auth).mockResolvedValue(mockManagerSession as never)
    vi.mocked(prisma.product.findMany).mockResolvedValue([mockProduct] as never)

    const response = await inventoryGET(
      new Request("http://localhost/api/reports/inventory")
    )

    expect(response.status).toBe(200)
    expect(response.headers.get("Content-Type")).toBe(
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    )
    expect(response.headers.get("Content-Disposition")).toContain(
      "inventory-report-"
    )
    expect(response.headers.get("Content-Disposition")).toContain(".xlsx")
    const buffer = await response.arrayBuffer()
    expect(buffer.byteLength).toBeGreaterThan(0)
  })
})

describe("GET /api/reports/movements (REPT-04)", () => {
  it("returns 401 with no mocked session and never calls prisma.stockTransaction.findMany", async () => {
    vi.mocked(auth).mockResolvedValue(null as never)
    const response = await movementsGET(
      new Request("http://localhost/api/reports/movements")
    )
    expect(response.status).toBe(401)
    expect(prisma.stockTransaction.findMany).not.toHaveBeenCalled()
  })

  it("returns a real .xlsx buffer with correct headers for a MANAGER session", async () => {
    vi.mocked(auth).mockResolvedValue(mockManagerSession as never)
    vi.mocked(prisma.stockTransaction.findMany).mockResolvedValue([
      mockTransaction,
    ] as never)

    const response = await movementsGET(
      new Request("http://localhost/api/reports/movements")
    )

    expect(response.status).toBe(200)
    expect(response.headers.get("Content-Disposition")).toContain(
      "movements-report-"
    )
    const buffer = await response.arrayBuffer()
    expect(buffer.byteLength).toBeGreaterThan(0)
  })

  it("never throws on malformed ?from=/?to= and passes valid, non-NaN Date instances to prisma", async () => {
    vi.mocked(auth).mockResolvedValue(mockManagerSession as never)
    vi.mocked(prisma.stockTransaction.findMany).mockResolvedValue([] as never)

    const response = await movementsGET(
      new Request(
        "http://localhost/api/reports/movements?from=garbage&to=garbage"
      )
    )

    expect(response.status).toBe(200)
    const call = vi.mocked(prisma.stockTransaction.findMany).mock.calls[0][0] as {
      where: { createdAt: { gte: Date; lte: Date } }
    }
    const gte = call.where.createdAt.gte
    const lte = call.where.createdAt.lte
    expect(gte).toBeInstanceOf(Date)
    expect(lte).toBeInstanceOf(Date)
    expect(Number.isNaN(gte.getTime())).toBe(false)
    expect(Number.isNaN(lte.getTime())).toBe(false)
  })
})

describe("GET /api/reports/purchase-orders (REPT-04)", () => {
  it("returns 401 with no mocked session and never calls prisma.purchaseOrder.findMany", async () => {
    vi.mocked(auth).mockResolvedValue(null as never)
    const response = await purchaseOrdersGET(
      new Request("http://localhost/api/reports/purchase-orders")
    )
    expect(response.status).toBe(401)
    expect(prisma.purchaseOrder.findMany).not.toHaveBeenCalled()
  })

  it("returns 403 with a mocked STAFF session and never calls prisma.purchaseOrder.findMany", async () => {
    vi.mocked(auth).mockResolvedValue(mockStaffSession as never)
    const response = await purchaseOrdersGET(
      new Request("http://localhost/api/reports/purchase-orders")
    )
    expect(response.status).toBe(403)
    expect(prisma.purchaseOrder.findMany).not.toHaveBeenCalled()
  })

  it("returns a real .xlsx buffer with correct headers for a MANAGER session", async () => {
    vi.mocked(auth).mockResolvedValue(mockManagerSession as never)
    vi.mocked(prisma.purchaseOrder.findMany).mockResolvedValue([
      mockPurchaseOrder,
    ] as never)

    const response = await purchaseOrdersGET(
      new Request("http://localhost/api/reports/purchase-orders")
    )

    expect(response.status).toBe(200)
    expect(response.headers.get("Content-Disposition")).toContain(
      "purchase-orders-report-"
    )
    const buffer = await response.arrayBuffer()
    expect(buffer.byteLength).toBeGreaterThan(0)
  })

  it("never filters by status — all three statuses are always included (D-11)", async () => {
    vi.mocked(auth).mockResolvedValue(mockManagerSession as never)
    vi.mocked(prisma.purchaseOrder.findMany).mockResolvedValue([
      mockPurchaseOrder,
    ] as never)

    await purchaseOrdersGET(
      new Request("http://localhost/api/reports/purchase-orders?status=DRAFT")
    )

    const call = vi.mocked(prisma.purchaseOrder.findMany).mock.calls[0][0] as {
      where?: unknown
    }
    expect(call.where).toBeUndefined()
  })

  it("maps the Total column from totalAmount.toNumber() exactly, never recomputed from line items", async () => {
    vi.mocked(auth).mockResolvedValue(mockManagerSession as never)
    const toNumberSpy = vi.fn(() => 199.99)
    vi.mocked(prisma.purchaseOrder.findMany).mockResolvedValue([
      { ...mockPurchaseOrder, totalAmount: { toNumber: toNumberSpy } },
    ] as never)

    await purchaseOrdersGET(
      new Request("http://localhost/api/reports/purchase-orders")
    )

    expect(toNumberSpy).toHaveBeenCalled()
  })
})
