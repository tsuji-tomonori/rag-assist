import { beforeEach, describe, expect, it, vi } from "vitest"
import { createAdminAuditExport } from "./auditLogApi.js"

function successResponse(body: unknown) {
  return {
    ok: true,
    status: 200,
    json: vi.fn().mockResolvedValue(body),
    text: vi.fn().mockResolvedValue(JSON.stringify(body))
  }
}

describe("auditLogApi export", () => {
  beforeEach(() => vi.stubEnv("VITE_API_BASE_URL", "/api"))

  it("posts the normalized read query and mandatory reason", async () => {
    const artifact = {
      exportType: "audit_log" as const,
      url: "https://example.com/export",
      expiresInSeconds: 300,
      objectKey: "downloads/tenant-1/audit.json",
      generatedAt: "2026-07-15T00:00:00.000Z",
      redaction: { policyVersion: "admin-export-redaction-v1", redactedFields: ["credentials"], notes: [] }
    }
    const fetchMock = vi.fn().mockResolvedValue(successResponse(artifact))
    vi.stubGlobal("fetch", fetchMock)

    await expect(createAdminAuditExport({ query: "denied", action: "role:assign" }, "四半期 access review")).resolves.toEqual(artifact)
    expect(fetchMock).toHaveBeenCalledWith("/api/admin/audit-log/export", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query: { query: "denied", action: "role:assign" }, reason: "四半期 access review" })
    })
  })
})
