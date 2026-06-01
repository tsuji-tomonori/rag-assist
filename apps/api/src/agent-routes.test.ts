import assert from "node:assert/strict"
import test from "node:test"
import app from "./app.js"

test("async agent API entrypoints are disabled", async () => {
  const requests: Array<[string, RequestInit | undefined]> = [
    ["/agents/providers", undefined],
    ["/agents/provider-settings", undefined],
    ["/agents/runs", undefined],
    ["/agents/runs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ provider: "codex", modelId: "codex-placeholder", instruction: "仕様差分を確認する" })
    }],
    ["/agents/runs/missing-agent-run", undefined],
    ["/agents/runs/missing-agent-run/cancel", { method: "POST" }],
    ["/agents/runs/missing-agent-run/artifacts", undefined],
    ["/agents/runs/missing-agent-run/artifacts/missing-artifact", undefined],
    ["/agents/runs/missing-agent-run/artifacts/missing-artifact/writeback", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ writebackStatus: "approved" })
    }]
  ]

  for (const [path, init] of requests) {
    const response = await app.request(path, init)
    assert.equal(response.status, 404, `${init?.method ?? "GET"} ${path}`)
    assert.deepEqual(await response.json(), { error: "Not found" })
  }
})
