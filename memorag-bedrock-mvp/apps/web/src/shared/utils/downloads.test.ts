import { beforeEach, describe, expect, it, vi } from "vitest"
import { downloadBenchmarkArtifact } from "./downloads.js"
import { createBenchmarkDownload } from "../../features/benchmark/api/benchmarkApi.js"

vi.mock("../../features/benchmark/api/benchmarkApi.js", () => ({
  createBenchmarkDownload: vi.fn()
}))

const createBenchmarkDownloadMock = vi.mocked(createBenchmarkDownload)

describe("downloadBenchmarkArtifact", () => {
  beforeEach(() => {
    createBenchmarkDownloadMock.mockResolvedValue({
      url: "https://signed.example/artifact",
      expiresInSeconds: 900,
      objectKey: "runs/bench-1/artifact"
    })
  })

  it.each([
    ["report", "benchmark-report-bench_with_unsafe_chars.md"],
    ["summary", "benchmark-summary-bench_with_unsafe_chars.json"],
    ["results", "benchmark-results-bench_with_unsafe_chars.jsonl"]
  ] as const)("sets the %s artifact download filename", async (artifact, expectedFileName) => {
    const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (this: HTMLAnchorElement) {
      expect(this.href).toBe("https://signed.example/artifact")
      expect(this.download).toBe(expectedFileName)
      expect(this.rel).toBe("noopener")
    })

    await downloadBenchmarkArtifact("bench/with:unsafe*chars", artifact)

    expect(createBenchmarkDownloadMock).toHaveBeenCalledWith("bench/with:unsafe*chars", artifact)
    expect(click).toHaveBeenCalledTimes(1)
  })
})
