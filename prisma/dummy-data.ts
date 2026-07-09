// prisma/dummy-data.ts — Standalone idempotent demo-data seed script
//
// NOT wired into `prisma db seed` / `postinstall` / any CI or deploy hook
// (T-Q260709-01 mitigation). Run manually via `npm run db:dummy`.
//
// Performs a full wipe of Category/Product/Supplier/StockTransaction/PurchaseOrder
// (in FK-safe order) and reseeds realistic Indonesian-market demo data. Never
// touches the `users` table beyond upserting 2 additional Staff accounts — the
// 2 pre-existing users (admin@logistics.com MANAGER, karin@logis.com STAFF)
// are never read from or written to by any deleteMany/updateMany call here.
//
// Does NOT modify or import from prisma/seed.ts — fully separate script.

import { PrismaClient, Prisma, Role } from "@prisma/client"
import { hash } from "bcryptjs"

const prisma = new PrismaClient()

const DAY_MS = 86_400_000

type MovementType = "STOCK_IN" | "STOCK_OUT"

interface MovementInput {
  type: MovementType
  quantity: number
  reason: string
  daysAgo: number
  notes?: string
}

interface AppliedMovement {
  type: MovementType
  quantity: number
  reason: string
  notes?: string
  createdAt: Date
}

/**
 * Sorts a product's movements oldest-first (daysAgo descending) and walks a
 * running balance starting at openingStock. STOCK_IN is added unconditionally;
 * STOCK_OUT is clamped to min(quantity, running) and skipped entirely if the
 * clamped amount is 0. This clamp is what guarantees the DB's
 * `currentStock >= 0` CHECK constraint (products_current_stock_non_negative)
 * can never be violated by a naive random walk.
 */
function applyMovements(
  openingStock: number,
  movements: MovementInput[]
): { finalStock: number; applied: AppliedMovement[] } {
  const sorted = [...movements].sort((a, b) => b.daysAgo - a.daysAgo)
  let running = openingStock
  const applied: AppliedMovement[] = []

  for (const m of sorted) {
    const createdAt = new Date(Date.now() - m.daysAgo * DAY_MS)
    if (m.type === "STOCK_IN") {
      running += m.quantity
      applied.push({ type: m.type, quantity: m.quantity, reason: m.reason, notes: m.notes, createdAt })
    } else {
      const clamped = Math.min(m.quantity, running)
      if (clamped <= 0) continue
      running -= clamped
      applied.push({ type: m.type, quantity: clamped, reason: m.reason, notes: m.notes, createdAt })
    }
  }

  return { finalStock: running, applied }
}

/** Mirrors actions/purchase-orders.ts's computeTotalAmount exactly. */
function computeTotalAmount(lineItems: { quantity: number; unitPrice: number }[]): Prisma.Decimal {
  return lineItems.reduce(
    (sum, li) => sum.plus(new Prisma.Decimal(li.quantity).times(li.unitPrice)),
    new Prisma.Decimal(0)
  )
}

interface ProductDef {
  sku: string
  name: string
  category: string
  reorderThreshold: number
  openingStock: number
  movements: MovementInput[]
}

interface SupplierDef {
  slot: string
  name: string
  contactPerson: string
  phone: string
  email: string
  address: string
}

interface LineItemDef {
  sku: string
  quantity: number
  unitPrice: number
  /** Only meaningful when the parent PO's status is RECEIVED. */
  receivedQuantity?: number
}

interface PurchaseOrderDef {
  status: "DRAFT" | "ORDERED" | "RECEIVED"
  supplierSlot: string
  lineItems: LineItemDef[]
}

async function main() {
  // ---------------------------------------------------------------------
  // Step 0 — full wipe, FK-safe order. Never touches `users`.
  // ---------------------------------------------------------------------
  console.log("Wiping existing Category/Product/Supplier/StockTransaction/PurchaseOrder data...")
  await prisma.stockTransaction.deleteMany({})
  await prisma.purchaseOrder.deleteMany({}) // line items cascade via onDelete: Cascade
  await prisma.product.deleteMany({})
  await prisma.category.deleteMany({})
  await prisma.supplier.deleteMany({})

  // ---------------------------------------------------------------------
  // Step 1 — Suppliers (Indonesian-market names)
  // ---------------------------------------------------------------------
  const supplierDefs: SupplierDef[] = [
    {
      slot: "S1",
      name: "PT Sumber Elektronik Jaya",
      contactPerson: "Andi Wijaya",
      phone: "+62 812-3456-7890",
      email: "andi.wijaya@sumberelektronik.co.id",
      address: "Jl. Gatot Subroto No. 45, Jakarta Selatan",
    },
    {
      slot: "S2",
      name: "CV Mitra Distribusi Nusantara",
      contactPerson: "Dewi Lestari",
      phone: "+62 813-2345-6789",
      email: "dewi.lestari@mitradistribusi.co.id",
      address: "Jl. Diponegoro No. 12, Bandung",
    },
    {
      slot: "S3",
      name: "PT Cahaya Komponen Indonesia",
      contactPerson: "Rudi Hartono",
      phone: "+62 811-9876-5432",
      email: "rudi.hartono@cahayakomponen.co.id",
      address: "Jl. Ahmad Yani No. 88, Surabaya",
    },
    {
      slot: "S4",
      name: "UD Berkah Perkakas",
      contactPerson: "Sri Mulyani",
      phone: "+62 812-1122-3344",
      email: "sri.mulyani@berkahperkakas.co.id",
      address: "Jl. Sudirman No. 21, Semarang",
    },
    {
      slot: "S5",
      name: "PT Kantor Sejahtera Abadi",
      contactPerson: "Bambang Setiawan",
      phone: "+62 814-5566-7788",
      email: "bambang.setiawan@kantorsejahtera.co.id",
      address: "Jl. Malioboro No. 5, Yogyakarta",
    },
  ]

  const supplierIdBySlot: Record<string, string> = {}
  for (const s of supplierDefs) {
    const created = await prisma.supplier.create({
      data: {
        name: s.name,
        contactPerson: s.contactPerson,
        phone: s.phone,
        email: s.email,
        address: s.address,
      },
    })
    supplierIdBySlot[s.slot] = created.id
  }
  console.log(`Seeded ${supplierDefs.length} suppliers.`)

  // ---------------------------------------------------------------------
  // Step 2 — Categories
  // ---------------------------------------------------------------------
  const categoryNames = [
    "Elektronik",
    "Aksesoris",
    "Peralatan Rumah Tangga",
    "Komponen",
    "Perlengkapan Kantor",
  ]
  const categoryIdByName: Record<string, string> = {}
  for (const name of categoryNames) {
    const created = await prisma.category.create({ data: { name } })
    categoryIdByName[name] = created.id
  }
  console.log(`Seeded ${categoryNames.length} categories.`)

  // ---------------------------------------------------------------------
  // Step 3 — Products (placeholder currentStock: 0; real value written in Step 7)
  //
  // Movement plan (Step 5) is designed so the eventual severity mix
  // (lib/utils/severity.ts tiers) lands at:
  //   Critical (currentStock === 0):            RT-003, KAN-003        (2)
  //   Warning (0 < currentStock <= threshold):  ELK-004, AKS-003,
  //                                              RT-002, KOMP-004       (4)
  //   OK (remainder):                           the other 11 products
  //
  // 6 "best seller" products (ELK-001, ELK-002, AKS-001, AKS-002, KAN-001,
  // KOMP-002) carry meaningfully larger cumulative STOCK_OUT quantities
  // (60-150 units total each) than the rest, so the Top Selling Products
  // dashboard ranking is visibly non-flat.
  // ---------------------------------------------------------------------
  const productDefs: ProductDef[] = [
    // Elektronik (ELK)
    {
      sku: "ELK-001",
      name: "Speaker Bluetooth JBL Go 3",
      category: "Elektronik",
      reorderThreshold: 10,
      openingStock: 200,
      movements: [
        { type: "STOCK_OUT", quantity: 60, reason: "Sale", daysAgo: 25 },
        { type: "STOCK_OUT", quantity: 45, reason: "Sale", daysAgo: 10 },
      ],
    },
    {
      sku: "ELK-002",
      name: "Power Bank Xiaomi 20000mAh",
      category: "Elektronik",
      reorderThreshold: 8,
      openingStock: 150,
      movements: [
        { type: "STOCK_OUT", quantity: 50, reason: "Sale", daysAgo: 20 },
        { type: "STOCK_OUT", quantity: 35, reason: "Sale", daysAgo: 8 },
      ],
    },
    {
      sku: "ELK-003",
      name: "Kabel Data USB-C Anker",
      category: "Elektronik",
      reorderThreshold: 15,
      openingStock: 80,
      movements: [{ type: "STOCK_OUT", quantity: 8, reason: "Manual Adjustment", daysAgo: 10 }],
    },
    {
      sku: "ELK-004",
      name: "Charger Adapter 65W",
      category: "Elektronik",
      reorderThreshold: 10,
      openingStock: 30,
      movements: [{ type: "STOCK_OUT", quantity: 25, reason: "Sale", daysAgo: 10 }],
    },
    // Aksesoris (AKS)
    {
      sku: "AKS-001",
      name: "Case Handphone Universal",
      category: "Aksesoris",
      reorderThreshold: 15,
      openingStock: 250,
      movements: [
        { type: "STOCK_OUT", quantity: 70, reason: "Sale", daysAgo: 22 },
        { type: "STOCK_OUT", quantity: 60, reason: "Sale", daysAgo: 9 },
      ],
    },
    {
      sku: "AKS-002",
      name: "Tempered Glass Anti Gores",
      category: "Aksesoris",
      reorderThreshold: 15,
      openingStock: 220,
      movements: [
        { type: "STOCK_OUT", quantity: 55, reason: "Sale", daysAgo: 18 },
        { type: "STOCK_OUT", quantity: 45, reason: "Sale", daysAgo: 6 },
      ],
    },
    {
      sku: "AKS-003",
      name: "Holder HP Mobil Magnetic",
      category: "Aksesoris",
      reorderThreshold: 12,
      openingStock: 40,
      movements: [{ type: "STOCK_OUT", quantity: 33, reason: "Sale", daysAgo: 15 }],
    },
    // Peralatan Rumah Tangga (RT)
    {
      sku: "RT-001",
      name: "Panci Set Stainless Steel",
      category: "Peralatan Rumah Tangga",
      reorderThreshold: 5,
      openingStock: 25,
      movements: [{ type: "STOCK_OUT", quantity: 4, reason: "Sale", daysAgo: 5 }],
    },
    {
      sku: "RT-002",
      name: "Rice Cooker Mini 1.8L",
      category: "Peralatan Rumah Tangga",
      reorderThreshold: 8,
      openingStock: 20,
      movements: [{ type: "STOCK_OUT", quantity: 15, reason: "Sale", daysAgo: 12 }],
    },
    {
      sku: "RT-003",
      name: "Setrika Uap Portable",
      category: "Peralatan Rumah Tangga",
      reorderThreshold: 5,
      openingStock: 12,
      movements: [{ type: "STOCK_OUT", quantity: 12, reason: "Sale", daysAgo: 8 }],
    },
    // Komponen (KOMP)
    {
      sku: "KOMP-001",
      name: "Motherboard ATX Gigabyte",
      category: "Komponen",
      reorderThreshold: 5,
      openingStock: 18,
      movements: [{ type: "STOCK_OUT", quantity: 3, reason: "Manual Adjustment", daysAgo: 6 }],
    },
    {
      sku: "KOMP-002",
      name: "RAM DDR4 8GB Kingston",
      category: "Komponen",
      reorderThreshold: 8,
      openingStock: 100,
      movements: [
        { type: "STOCK_OUT", quantity: 45, reason: "Sale", daysAgo: 16 },
        { type: "STOCK_OUT", quantity: 30, reason: "Sale", daysAgo: 5 },
      ],
    },
    {
      sku: "KOMP-003",
      name: "SSD NVMe 512GB Samsung",
      category: "Komponen",
      reorderThreshold: 6,
      openingStock: 25,
      movements: [{ type: "STOCK_OUT", quantity: 5, reason: "Sale", daysAgo: 9 }],
    },
    {
      sku: "KOMP-004",
      name: "PSU 550W 80+ Bronze",
      category: "Komponen",
      reorderThreshold: 6,
      openingStock: 15,
      movements: [{ type: "STOCK_OUT", quantity: 10, reason: "Sale", daysAgo: 14 }],
    },
    // Perlengkapan Kantor (KAN)
    {
      sku: "KAN-001",
      name: "Kertas HVS A4 80gsm",
      category: "Perlengkapan Kantor",
      reorderThreshold: 20,
      openingStock: 300,
      movements: [
        { type: "STOCK_OUT", quantity: 80, reason: "Sale", daysAgo: 27 },
        { type: "STOCK_OUT", quantity: 65, reason: "Sale", daysAgo: 13 },
      ],
    },
    {
      sku: "KAN-002",
      name: "Tinta Printer Epson Original",
      category: "Perlengkapan Kantor",
      reorderThreshold: 10,
      openingStock: 45,
      movements: [{ type: "STOCK_OUT", quantity: 6, reason: "Sale", daysAgo: 7 }],
    },
    {
      sku: "KAN-003",
      name: "Map Ordner Bantex",
      category: "Perlengkapan Kantor",
      reorderThreshold: 8,
      openingStock: 10,
      movements: [{ type: "STOCK_OUT", quantity: 10, reason: "Manual Adjustment", daysAgo: 3 }],
    },
  ]

  const productIdBySku: Record<string, string> = {}
  for (const def of productDefs) {
    const created = await prisma.product.create({
      data: {
        name: def.name,
        sku: def.sku,
        categoryId: categoryIdByName[def.category],
        reorderThreshold: def.reorderThreshold,
        currentStock: 0,
      },
    })
    productIdBySku[def.sku] = created.id
  }
  console.log(`Seeded ${productDefs.length} products.`)

  // ---------------------------------------------------------------------
  // Step 4 — Upsert 2 additional Staff users (idempotent on email), then
  // load all 4 live users (2 pre-existing + 2 new) for createdById use below.
  // ---------------------------------------------------------------------
  const staffPasswordHash = await hash("Staff@123", 12) // cost factor 12, same convention as seed.ts
  const staffDefs = [
    { email: "budi.santoso@logistics.com", name: "Budi Santoso" },
    { email: "siti.rahayu@logistics.com", name: "Siti Rahayu" },
  ]
  for (const s of staffDefs) {
    await prisma.user.upsert({
      where: { email: s.email },
      update: {},
      create: {
        email: s.email,
        name: s.name,
        passwordHash: staffPasswordHash,
        role: Role.STAFF,
        isActive: true,
      },
    })
  }

  const allUsers = await prisma.user.findMany()
  if (allUsers.length < 2) {
    throw new Error(
      "Expected at least the 2 pre-existing users (admin@logistics.com, karin@logis.com) to exist."
    )
  }
  function userIdAt(i: number): string {
    return allUsers[i % allUsers.length].id
  }
  console.log(`Resolved ${allUsers.length} users for createdById assignment.`)

  // ---------------------------------------------------------------------
  // Step 5 — Apply each product's natural-movement plan (not yet written to DB)
  // ---------------------------------------------------------------------
  interface StockTxRecord {
    type: MovementType
    productId: string
    quantity: number
    reason: string
    notes?: string
    createdById: string
    createdAt: Date
    purchaseOrderId?: string
  }

  const naturalStockTx: StockTxRecord[] = []
  const baseFinalStockBySku: Record<string, number> = {}

  productDefs.forEach((def, idx) => {
    const { finalStock, applied } = applyMovements(def.openingStock, def.movements)
    baseFinalStockBySku[def.sku] = finalStock
    for (const m of applied) {
      naturalStockTx.push({
        type: m.type,
        productId: productIdBySku[def.sku],
        quantity: m.quantity,
        reason: m.reason,
        notes: m.notes,
        createdById: userIdAt(idx),
        createdAt: m.createdAt,
      })
    }
  })

  // ---------------------------------------------------------------------
  // Step 6 — Seed exactly 8 PurchaseOrders: 2 DRAFT, 2 ORDERED, 4 RECEIVED.
  // RECEIVED-PO line items reference only "OK"-tier products so the folded
  // PO-received increments never disturb the Critical/Warning tiers designed
  // in Step 5's movement plan.
  // ---------------------------------------------------------------------
  const poDefs: PurchaseOrderDef[] = [
    {
      status: "DRAFT",
      supplierSlot: "S4",
      lineItems: [
        { sku: "RT-002", quantity: 20, unitPrice: 320_000 },
        { sku: "RT-003", quantity: 15, unitPrice: 410_000 },
      ],
    },
    {
      status: "DRAFT",
      supplierSlot: "S1",
      lineItems: [{ sku: "ELK-004", quantity: 25, unitPrice: 210_000 }],
    },
    {
      status: "ORDERED",
      supplierSlot: "S3",
      lineItems: [
        { sku: "KOMP-004", quantity: 12, unitPrice: 980_000 },
        { sku: "KAN-003", quantity: 10, unitPrice: 65_000 },
      ],
    },
    {
      status: "ORDERED",
      supplierSlot: "S2",
      lineItems: [
        { sku: "AKS-003", quantity: 20, unitPrice: 48_000 },
        { sku: "ELK-002", quantity: 10, unitPrice: 380_000 },
      ],
    },
    {
      status: "RECEIVED",
      supplierSlot: "S1",
      lineItems: [{ sku: "ELK-001", quantity: 10, unitPrice: 250_000, receivedQuantity: 10 }],
    },
    {
      status: "RECEIVED",
      supplierSlot: "S2",
      lineItems: [
        { sku: "AKS-001", quantity: 20, unitPrice: 35_000, receivedQuantity: 20 },
        { sku: "AKS-002", quantity: 15, unitPrice: 40_000, receivedQuantity: 13 },
      ],
    },
    {
      status: "RECEIVED",
      supplierSlot: "S3",
      lineItems: [{ sku: "KOMP-001", quantity: 8, unitPrice: 1_200_000, receivedQuantity: 8 }],
    },
    {
      status: "RECEIVED",
      supplierSlot: "S5",
      lineItems: [
        { sku: "KAN-001", quantity: 30, unitPrice: 55_000, receivedQuantity: 30 },
        { sku: "KAN-002", quantity: 15, unitPrice: 85_000, receivedQuantity: 15 },
      ],
    },
  ]

  const poLinkedStockTx: StockTxRecord[] = []
  const receivedIncrementBySku: Record<string, number> = {}
  let receivedTxDaysAgoCounter = 2

  for (const [poIdx, poDef] of poDefs.entries()) {
    const totalAmount = computeTotalAmount(
      poDef.lineItems.map((li) => ({ quantity: li.quantity, unitPrice: li.unitPrice }))
    )
    const createdById = userIdAt(poIdx + 3)

    const po = await prisma.purchaseOrder.create({
      data: {
        supplierId: supplierIdBySlot[poDef.supplierSlot],
        status: poDef.status,
        totalAmount,
        createdById,
        lineItems: {
          create: poDef.lineItems.map((li) => ({
            productId: productIdBySku[li.sku],
            quantity: li.quantity,
            unitPrice: new Prisma.Decimal(li.unitPrice),
            receivedQuantity: poDef.status === "RECEIVED" ? li.receivedQuantity ?? li.quantity : null,
          })),
        },
      },
    })

    if (poDef.status === "RECEIVED") {
      for (const li of poDef.lineItems) {
        const receivedQty = li.receivedQuantity ?? li.quantity
        poLinkedStockTx.push({
          type: "STOCK_IN",
          productId: productIdBySku[li.sku],
          quantity: receivedQty,
          reason: "Purchase Received",
          createdById,
          createdAt: new Date(Date.now() - receivedTxDaysAgoCounter * DAY_MS),
          purchaseOrderId: po.id,
        })
        receivedTxDaysAgoCounter += 3
        receivedIncrementBySku[li.sku] = (receivedIncrementBySku[li.sku] ?? 0) + receivedQty
      }
    }
  }
  console.log(`Seeded ${poDefs.length} purchase orders.`)

  // ---------------------------------------------------------------------
  // Step 7 — Write all Step 5 + Step 6 StockTransaction rows, then update
  // each product's currentStock to its combined final value.
  // ---------------------------------------------------------------------
  const allStockTx = [...naturalStockTx, ...poLinkedStockTx]
  for (const tx of allStockTx) {
    await prisma.stockTransaction.create({
      data: {
        type: tx.type,
        productId: tx.productId,
        quantity: tx.quantity,
        reason: tx.reason,
        notes: tx.notes ?? null,
        createdById: tx.createdById,
        createdAt: tx.createdAt,
        purchaseOrderId: tx.purchaseOrderId,
      },
    })
  }

  for (const def of productDefs) {
    const finalStock = (baseFinalStockBySku[def.sku] ?? 0) + (receivedIncrementBySku[def.sku] ?? 0)
    await prisma.product.update({
      where: { id: productIdBySku[def.sku] },
      data: { currentStock: finalStock },
    })
  }
  console.log(`Wrote ${allStockTx.length} stock transactions and finalized product stock levels.`)

  // ---------------------------------------------------------------------
  // Step 8 — Print authoritative row-count summary
  // ---------------------------------------------------------------------
  const [categoryCount, productCount, supplierCount, userCount, stockTransactionCount, purchaseOrderCount] =
    await Promise.all([
      prisma.category.count(),
      prisma.product.count(),
      prisma.supplier.count(),
      prisma.user.count(),
      prisma.stockTransaction.count(),
      prisma.purchaseOrder.count(),
    ])

  console.log("=== Dummy Data Seed Summary ===")
  console.log(`Categories: ${categoryCount}`)
  console.log(`Products: ${productCount}`)
  console.log(`Suppliers: ${supplierCount}`)
  console.log(`Users: ${userCount}`)
  console.log(`Stock Transactions: ${stockTransactionCount}`)
  console.log(`Purchase Orders: ${purchaseOrderCount}`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
