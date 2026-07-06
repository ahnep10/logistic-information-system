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
