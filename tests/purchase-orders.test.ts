/**
 * Purchase order tests — covers PROC-01, PROC-02, PROC-03, PROC-04
 *
 * Implementation notes:
 *   - Unit tests for Zod schema validation (createPurchaseOrderSchema, confirmPurchaseOrderSchema, receivePurchaseOrderSchema)
 *   - Unit tests for assertPOEditable immutability guard
 *   - Integration test stubs (it.todo) for Server Actions (receivePurchaseOrder, confirmPurchaseOrder) built in 04-04
 *   - No @prisma/client imports — unit tests are pure logic, no DB connection needed
 *   - PROC-01/PROC-02: createPurchaseOrderSchema allows 0 line items on Draft save (D-08), rejects invalid line items
 *   - PROC-01: confirmPurchaseOrderSchema requires at least 1 line item at confirm time (D-08)
 *   - PROC-02: receivePurchaseOrderSchema allows receivedQuantity of 0, rejects negative values
 *   - PROC-03/PROC-04: assertPOEditable enforces RECEIVED immutability (D-17)
 */

import {
  createPurchaseOrderSchema,
  confirmPurchaseOrderSchema,
  receivePurchaseOrderSchema,
  assertPOEditable,
} from "@/lib/validations/purchase-order"

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

  // 04-04 | Implementation: mock prisma.$transaction; assert PO row lock acquired via SELECT ... FOR UPDATE before any write
  it.todo("receivePurchaseOrder acquires a PO row lock via SELECT ... FOR UPDATE before any write")

  // 04-04 | Implementation: mock prisma.$transaction; call receivePurchaseOrder on a PO whose status is not ORDERED
  // Assert: receivePurchaseOrder returns { error: "This purchase order has already been received." } (D-22 double-receipt race)
  it.todo("receivePurchaseOrder rejects when the PO status is not ORDERED (double-receipt race, D-22)")

  // 04-04 | Implementation: mock prisma.$transaction; call receivePurchaseOrder with multiple line items
  // Assert: one StockTransaction created per line with reason "Purchase Received" and purchaseOrderId set
  it.todo("receivePurchaseOrder creates one StockTransaction per line with reason 'Purchase Received' and purchaseOrderId set")

  // 04-04 | Implementation: mock prisma.$transaction; assert tx.product.update called with { increment: receivedQuantity } per line
  it.todo("receivePurchaseOrder increments Product.currentStock per line")

  // 04-04 | Implementation: mock prisma.$transaction; assert tx.purchaseOrder.update called with status: RECEIVED
  it.todo("receivePurchaseOrder updates purchase order status to RECEIVED")
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

  // D-16 | stale-reference re-validation is implemented in 04-04's confirmPurchaseOrder
  it.todo(
    "confirmPurchaseOrder rejects when supplier or a line-item product has been deactivated since Draft creation (D-16)"
  )
})
