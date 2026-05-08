import { beforeEach, describe, expect, it, vi } from "vitest"
import { downloadBenchmarkArtifact } from "./downloads.js"
import { createBenchmarkDownload, getBenchmarkCodeBuildLogs } from "../../features/benchmark/api/benchmarkApi.js"

vi.mock("../../features/benchmark/api/benchmarkApi.js", () => ({
  createBenchmarkDownload: vi.fn(),
  getBenchmarkCodeBuildLogs: vi.fn()
}))

const createBenchmarkDownloadMock = vi.mocked(createBenchmarkDownload)
const getBenchmarkCodeBuildLogsMock = vi.mocked(getBenchmarkCodeBuildLogs)

describe("downloadBenchmarkArtifact", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    createBenchmarkDownloadMock.mockResolvedValue({
      url: "https://signed.example/artifact",
      expiresInSeconds: 900,
      objectKey: "runs/bench-1/artifact"
    })
    getBenchmarkCodeBuildLogsMock.mockResolvedValue("install\nbuild\n")
    vi.stubGlobal("URL", {
      createObjectURL: vi.fn(() => "blob:benchmark-logs"),
      revokeObjectURL: vi.fn()
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

  it("downloads CodeBuild logs as txt from the protected API", async () => {
    const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (this: HTMLAnchorElement) {
      expect(this.href).toBe("blob:benchmark-logs")
      expect(this.download).toBe("benchmark-logs-bench_with_unsafe_chars.txt")
      expect(this.rel).toBe("noopener")
    })

    await downloadBenchmarkArtifact("bench/with:unsafe*chars", "logs")

    expect(getBenchmarkCodeBuildLogsMock).toHaveBeenCalledWith("bench/with:unsafe*chars")
    expect(createBenchmarkDownloadMock).not.toHaveBeenCalled()
    expect(click).toHaveBeenCalledTimes(1)
    expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:benchmark-logs")
  })
})
