import { describe, expect, it, vi } from "vitest"
import { fileToBase64 } from "./fileToBase64.js"

describe("fileToBase64", () => {
  it("returns raw FileReader results without a data URL prefix", async () => {
    const originalFileReader = globalThis.FileReader
    class RawFileReader {
      result: string | null = null
      error: Error | null = null
      onload: (() => void) | null = null
      onerror: (() => void) | null = null
      readAsDataURL() {
        this.result = "plain-base64"
        this.onload?.()
      }
    }
    vi.stubGlobal("FileReader", RawFileReader)

    await expect(fileToBase64(new File(["body"], "a.txt"))).resolves.toBe("plain-base64")

    vi.stubGlobal("FileReader", originalFileReader)
  })

  it("rejects FileReader errors", async () => {
    const originalFileReader = globalThis.FileReader
    class ErrorFileReader {
      result: string | null = null
      error = new Error("read failed")
      onload: (() => void) | null = null
      onerror: (() => void) | null = null
      readAsDataURL() {
        this.onerror?.()
      }
    }
    vi.stubGlobal("FileReader", ErrorFileReader)

    await expect(fileToBase64(new File(["body"], "a.txt"))).rejects.toThrow("read failed")

    vi.stubGlobal("FileReader", originalFileReader)
  })
})
