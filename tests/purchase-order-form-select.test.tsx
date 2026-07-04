/**
 * Regression test for the supplierId Select on the New Purchase Order form
 * (app/(protected)/purchase-orders/po-form-client.tsx).
 *
 * Background: Base UI's Select.Root determines controlled-vs-uncontrolled exactly
 * once, on the first render of a mounted instance (`value !== undefined`). Using
 * `defaultValue={field.value}` (uncontrolled) instead of `value={field.value ?? ""}`
 * (controlled) causes Base UI to log "changing the uncontrolled value state of Select
 * to be controlled" / "changing the default value state of an uncontrolled Select"
 * console errors once react-hook-form's field value changes.
 *
 * This test drives the component through a real SSR (`renderToString`) -> client
 * hydration (`hydrateRoot`) pass -- the same lifecycle Next.js uses -- and asserts no
 * Base UI console errors are emitted. This guards against regressing back to the
 * `defaultValue`-only pattern (see debug session .planning/debug/resolved/select-uncontrolled-warning.md).
 */
import * as React from "react"
import { renderToString } from "react-dom/server"
import { hydrateRoot } from "react-dom/client"
import { render, screen } from "@testing-library/react"
import { describe, it, expect, vi } from "vitest"

vi.mock("@/actions/purchase-orders", () => ({
  createDraftPurchaseOrder: vi.fn(),
  updateDraftPurchaseOrder: vi.fn(),
}))

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
}))

import PurchaseOrderForm from "@/app/(protected)/purchase-orders/po-form-client"

describe("PurchaseOrderForm — supplierId Select (Base UI controlled-value regression)", () => {
  it("emits no Base UI console errors across an SSR -> hydrate pass under StrictMode", async () => {
    const errors: string[] = []
    const errSpy = vi.spyOn(console, "error").mockImplementation((...args) => {
      errors.push(args.map(String).join(" "))
    })

    const suppliers = [{ id: "sup1", name: "Acme Co", isActive: true }]
    const products = [{ id: "prod1", name: "Widget", sku: "W-1" }]

    const element = (
      <React.StrictMode>
        <PurchaseOrderForm mode="create" suppliers={suppliers} products={products} />
      </React.StrictMode>
    )

    const html = renderToString(element)
    const container = document.createElement("div")
    container.innerHTML = html
    document.body.appendChild(container)

    hydrateRoot(container, element)

    // Let mount effects (where Base UI's controlled/uncontrolled check runs) flush.
    await new Promise((resolve) => setTimeout(resolve, 100))

    errSpy.mockRestore()

    const baseUiErrors = errors.filter((e) => e.includes("Base UI"))
    expect(baseUiErrors).toEqual([])
  })
})

describe("PurchaseOrderForm — supplierId Select label display (WR-06 follow-up)", () => {
  // Base UI's Select.Value renders the raw `value` (not the matching item's label)
  // unless Select.Root is given an `items` prop -- the corresponding Select.Item only
  // registers its label once the popup has actually been opened/mounted, which never
  // happens on an initial closed render. This affects ANY pre-populated Select
  // (edit mode), not just deactivated references -- verified for both cases here.
  it("shows the active supplier's name, not its raw id, on initial render", () => {
    render(
      <PurchaseOrderForm
        mode="edit"
        purchaseOrder={{ id: "po_1", supplierId: "sup_active_1", lineItems: [] }}
        suppliers={[{ id: "sup_active_1", name: "Active Co", isActive: true }]}
        products={[]}
      />
    )

    expect(screen.getByText("Active Co")).toBeTruthy()
    expect(screen.queryByText("sup_active_1")).toBeNull()
  })

  it("shows the deactivated supplier's name with an (inactive) suffix, not its raw id", () => {
    render(
      <PurchaseOrderForm
        mode="edit"
        purchaseOrder={{ id: "po_1", supplierId: "sup_inactive_1", lineItems: [] }}
        suppliers={[{ id: "sup_inactive_1", name: "Old Supplier Co", isActive: false }]}
        products={[]}
      />
    )

    expect(screen.getByText("Old Supplier Co (inactive)")).toBeTruthy()
    expect(screen.queryByText("sup_inactive_1")).toBeNull()
  })
})
