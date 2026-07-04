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

    const suppliers = [{ id: "sup1", name: "Acme Co" }]
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
