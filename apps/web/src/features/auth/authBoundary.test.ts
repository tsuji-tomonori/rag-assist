import { existsSync } from "node:fs"
import { describe, expect, it } from "vitest"

describe("auth feature boundary", () => {
  it("does not restore legacy root auth entrypoints", () => {
    expect(existsSync(new URL("../../LoginPage.tsx", import.meta.url))).toBe(false)
    expect(existsSync(new URL("../../authClient.ts", import.meta.url))).toBe(false)
  })
})
