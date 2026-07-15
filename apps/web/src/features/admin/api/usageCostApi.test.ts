import { beforeEach, describe, expect, it, vi } from "vitest"
import { createCostExport, getCostAuditSummary } from "./costApi.js"
import { buildUsageQuery, createUsageExport, listUsageSummaries } from "./usageApi.js"

function response(body: unknown) {
  return { ok: true, status: 200, json: vi.fn().mockResolvedValue(body), text: vi.fn().mockResolvedValue(JSON.stringify(body)) }
}

describe("usage and cost admin APIs", () => {
  beforeEach(() => vi.stubEnv("VITE_API_BASE_URL", "/api"))

  it("serializes every supported usage filter and omits absent values", () => {
    expect(buildUsageQuery({})).toBe("")
    expect(buildUsageQuery({ periodStart: "start", periodEnd: "end", subjectId: "subject", runId: "run", modelId: "model", feature: "chat", provider: "bedrock", cursor: "next", limit: 25 }))
      .toBe("?periodStart=start&periodEnd=end&subjectId=subject&runId=run&modelId=model&feature=chat&provider=bedrock&cursor=next&limit=25")
    expect(buildUsageQuery({ subjectId: "", limit: 0 })).toBe("")
  })

  it("accepts only structurally usable usage summaries", async () => {
    const valid = { events: [], completeness: {}, breakdowns: {} }
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(response(valid))
      .mockResolvedValueOnce(response(null))
      .mockResolvedValueOnce(response({ ...valid, events: null }))
      .mockResolvedValueOnce(response({ ...valid, completeness: null }))
      .mockResolvedValueOnce(response({ ...valid, breakdowns: null }))
    vi.stubGlobal("fetch", fetchMock)
    await expect(listUsageSummaries({ provider: "bedrock" })).resolves.toEqual(valid)
    await expect(listUsageSummaries()).resolves.toBeNull()
    await expect(listUsageSummaries()).resolves.toBeNull()
    await expect(listUsageSummaries()).resolves.toBeNull()
    await expect(listUsageSummaries()).resolves.toBeNull()
  })

  it("accepts only complete cost summary shapes", async () => {
    const valid = { currency: "USD", pricedCostUsd: 1, items: [], catalogVersions: [], completeness: {}, query: {} }
    const invalid = [null, { ...valid, currency: "JPY" }, { ...valid, pricedCostUsd: "1" }, { ...valid, items: null },
      { ...valid, catalogVersions: null }, { ...valid, completeness: null }, { ...valid, query: null }]
    const fetchMock = vi.fn().mockResolvedValueOnce(response(valid))
    for (const value of invalid) fetchMock.mockResolvedValueOnce(response(value))
    vi.stubGlobal("fetch", fetchMock)
    await expect(getCostAuditSummary()).resolves.toEqual(valid)
    for (const _value of invalid) await expect(getCostAuditSummary()).resolves.toBeNull()
  })

  it("posts separate usage and cost export requests", async () => {
    const artifact = { url: "https://example.com/export.json" }
    const fetchMock = vi.fn().mockResolvedValue(response(artifact))
    vi.stubGlobal("fetch", fetchMock)
    await expect(createUsageExport({ provider: "bedrock" }, "usage audit")).resolves.toEqual(artifact)
    await expect(createCostExport({ modelId: "model-1" }, "cost audit")).resolves.toEqual(artifact)
    expect(fetchMock).toHaveBeenNthCalledWith(1, "/api/admin/usage/export", expect.objectContaining({ body: JSON.stringify({ query: { provider: "bedrock" }, reason: "usage audit" }) }))
    expect(fetchMock).toHaveBeenNthCalledWith(2, "/api/admin/costs/export", expect.objectContaining({ body: JSON.stringify({ query: { modelId: "model-1" }, reason: "cost audit" }) }))
  })
})
