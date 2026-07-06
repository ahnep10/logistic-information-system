/**
 * Products page tests — covers DASH-02
 *
 * Implementation notes:
 *   - Unit tests for ProductsPage's server-side `?stock=low` searchParams filtering
 *   - Uses vi.mock("@/lib/prisma", ...) / vi.mock("@/lib/auth", ...) convention
 *     established in tests/purchase-orders.test.ts — no real DB connection needed
 *   - Whitelist validation: only the exact literal "low" triggers the FieldRef filter;
 *     any other value (wrong case, unrelated truthy string) or absence falls back to
 *     the unfiltered where: {} (RESEARCH.md Pitfall 2)
 */

import { vi, beforeEach } from "vitest"

vi.mock("@/lib/auth", () => ({
  auth: vi.fn(),
}))

vi.mock("@/lib/prisma", () => ({
  prisma: {
    product: {
      findMany: vi.fn(),
      fields: { reorderThreshold: "REORDER_THRESHOLD_FIELDREF" },
    },
    category: {
      findMany: vi.fn(),
    },
  },
}))

const { auth } = await import("@/lib/auth")
const { prisma } = await import("@/lib/prisma")
const ProductsPage = (await import("@/app/(protected)/products/page")).default

const mockProduct = {
  id: "prod_1",
  name: "Widget",
  sku: "SKU-001",
  categoryId: "cat_1",
  category: { name: "Widgets", isActive: true },
  reorderThreshold: 10,
  currentStock: 5,
  isActive: true,
}

describe("ProductsPage — app/(protected)/products/page.tsx (?stock=low filtering)", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(auth).mockResolvedValue({
      user: { role: "MANAGER" },
    } as never)
    vi.mocked(prisma.category.findMany).mockResolvedValue([] as never)
  })

  // DASH-02: no stock param -> fully unfiltered where: {}
  it("with no stock param, calls findMany with an unfiltered where: {}", async () => {
    vi.mocked(prisma.product.findMany).mockResolvedValue([mockProduct] as never)

    await ProductsPage({ searchParams: Promise.resolve({}) })

    const call = vi.mocked(prisma.product.findMany).mock.calls[0][0] as {
      where?: unknown
    }
    expect(call.where).toEqual({})
  })

  // DASH-02: ?stock=low -> FieldRef filter applied exactly
  it('with stock="low", calls findMany with the FieldRef where clause', async () => {
    vi.mocked(prisma.product.findMany).mockResolvedValue([mockProduct] as never)

    await ProductsPage({ searchParams: Promise.resolve({ stock: "low" }) })

    const call = vi.mocked(prisma.product.findMany).mock.calls[0][0] as {
      where?: unknown
    }
    expect(call.where).toEqual({
      isActive: true,
      currentStock: { lte: "REORDER_THRESHOLD_FIELDREF" },
    })
  })

  // DASH-02 | RESEARCH.md Pitfall 2: wrong case -> unfiltered, no error
  it('with stock="LOW" (wrong case), calls findMany with unfiltered where: {}', async () => {
    vi.mocked(prisma.product.findMany).mockResolvedValue([mockProduct] as never)

    await ProductsPage({ searchParams: Promise.resolve({ stock: "LOW" }) })

    const call = vi.mocked(prisma.product.findMany).mock.calls[0][0] as {
      where?: unknown
    }
    expect(call.where).toEqual({})
  })

  // DASH-02 | RESEARCH.md Pitfall 2: unrelated truthy string -> unfiltered, no error
  it('with stock="true" (unrelated truthy string), calls findMany with unfiltered where: {}', async () => {
    vi.mocked(prisma.product.findMany).mockResolvedValue([mockProduct] as never)

    await ProductsPage({ searchParams: Promise.resolve({ stock: "true" }) })

    const call = vi.mocked(prisma.product.findMany).mock.calls[0][0] as {
      where?: unknown
    }
    expect(call.where).toEqual({})
  })

  // DASH-02: isLowStockFiltered / lowStockCount props computed correctly when filtered
  it('with stock="low", returns isLowStockFiltered=true and lowStockCount = findMany result length', async () => {
    vi.mocked(prisma.product.findMany).mockResolvedValue([
      mockProduct,
      { ...mockProduct, id: "prod_2" },
    ] as never)

    const element = await ProductsPage({
      searchParams: Promise.resolve({ stock: "low" }),
    })

    expect(element.props.isLowStockFiltered).toBe(true)
    expect(element.props.lowStockCount).toBe(2)
  })

  // DASH-02: isLowStockFiltered=false when stock param absent
  it("with no stock param, returns isLowStockFiltered=false", async () => {
    vi.mocked(prisma.product.findMany).mockResolvedValue([mockProduct] as never)

    const element = await ProductsPage({ searchParams: Promise.resolve({}) })

    expect(element.props.isLowStockFiltered).toBe(false)
  })
})
