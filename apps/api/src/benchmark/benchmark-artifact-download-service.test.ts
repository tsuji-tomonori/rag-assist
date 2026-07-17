import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"
import { fileURLToPath } from "node:url"
import type { AppUser } from "../auth.js"
import type { BenchmarkRun } from "../types.js"
import {
  BenchmarkArtifactDownloadService,
  createBenchmarkArtifactDownloadMetadata,
  type BenchmarkArtifactDownloadPorts
} from "./benchmark-artifact-download-service.js"

test("BenchmarkArtifactDownloadService source depends on narrow download ports", () => {
  const source = readFileSync(fileURLToPath(new URL("./benchmark-artifact-download-service.ts", import.meta.url)), "utf8")
  const facade = readFileSync(fileURLToPath(new URL("../rag/memorag-service.ts", import.meta.url)), "utf8")
  const facadeMethod = facade.match(/async createBenchmarkArtifactDownloadUrl[\s\S]*?\n[ ]{2}}\n\n[ ]{2}async getBenchmarkCodeBuildLogText/)?.[0]

  assert.doesNotMatch(source, /\bDependencies\b/)
  assert.doesNotMatch(source, /@aws-sdk\//)
  assert.doesNotMatch(source, /from "\.\.\/config\.js"/)
  assert.doesNotMatch(source, /authorization/)
  assert.ok(facadeMethod)
  assert.match(facadeMethod, /this\.benchmarkArtifactDownloadService\.createDownload/)
  assert.doesNotMatch(facadeMethod, /this\.deps|S3Client|GetObjectCommand|getSignedUrl/)
})

test("BenchmarkArtifactDownloadService uses the authoritative tenant and hides missing or cross-tenant runs", async () => {
  const run = benchmarkRun("tenant-a", "tenant-a-only")
  const tenantCalls: AppUser[] = []
  const getCalls: Array<{ tenantId: string; runId: string }> = []
  let signCount = 0
  const service = new BenchmarkArtifactDownloadService({
    benchmarkRunStore: {
      get: async (tenantId, runId) => {
        getCalls.push({ tenantId, runId })
        return tenantId === run.tenantId && runId === run.runId ? run : undefined
      }
    },
    tenantIdForActor: (value) => {
      tenantCalls.push(value)
      if (!value.tenantId) throw new Error("authoritative tenant required")
      return value.tenantId
    },
    signArtifact: async () => {
      signCount += 1
      return "https://signed.invalid"
    },
    bucketName: "benchmark-bucket",
    downloadExpiresInSeconds: 900
  })

  assert.equal(await service.createDownload(actor("tenant-b"), run.runId, "summary"), undefined)
  assert.equal(await service.createDownload(actor("tenant-a"), "missing", "summary"), undefined)
  assert.deepEqual(getCalls, [
    { tenantId: "tenant-b", runId: run.runId },
    { tenantId: "tenant-a", runId: "missing" }
  ])
  assert.deepEqual(tenantCalls.map((value) => value.tenantId), ["tenant-b", "tenant-a"])
  assert.equal(signCount, 0)
})

test("BenchmarkArtifactDownloadService preserves stored CodeBuild log URLs without signing", async () => {
  let signCount = 0
  const withoutLog = benchmarkRun("tenant-a", "without-log")
  const withLog = {
    ...benchmarkRun("tenant-a", "with-log"),
    codeBuildBuildId: "memo-benchmark:build-id",
    codeBuildLogUrl: "https://console.aws.amazon.com/codesuite/codebuild/projects/memo/build/build-id/log"
  }
  const service = fixture([withoutLog, withLog], {
    downloadExpiresInSeconds: 15,
    signArtifact: async () => {
      signCount += 1
      return "https://signed.invalid"
    }
  })

  assert.equal(await service.createDownload(actor("tenant-a"), withoutLog.runId, "logs"), undefined)
  assert.deepEqual(await service.createDownload(actor("tenant-a"), withLog.runId, "logs"), {
    url: withLog.codeBuildLogUrl,
    expiresInSeconds: 15,
    objectKey: withLog.codeBuildBuildId
  })
  assert.equal(signCount, 0)
})

test("BenchmarkArtifactDownloadService selects each artifact key and signs exact attachment metadata", async () => {
  const run = {
    ...benchmarkRun("tenant-a", "bench/with:unsafe*chars"),
    summaryS3Key: "runs/bench/summary.json",
    resultsS3Key: "runs/bench/results.jsonl",
    reportS3Key: "runs/bench/report.md"
  }
  const signInputs: Array<Parameters<BenchmarkArtifactDownloadPorts["signArtifact"]>[0]> = []
  const service = fixture([run], {
    downloadExpiresInSeconds: 900,
    signArtifact: async (input) => {
      signInputs.push(input)
      return `https://signed.invalid/${input.objectKey}`
    }
  })

  for (const artifact of ["summary", "results", "report"] as const) {
    const result = await service.createDownload(actor("tenant-a"), run.runId, artifact)
    assert.equal(result?.objectKey, run[`${artifact}S3Key`])
    assert.equal(result?.expiresInSeconds, 900)
  }

  assert.deepEqual(signInputs, [
    {
      bucketName: "benchmark-bucket",
      objectKey: run.summaryS3Key,
      contentDisposition: 'attachment; filename="benchmark-summary-bench_with_unsafe_chars.json"',
      expiresInSeconds: 900
    },
    {
      bucketName: "benchmark-bucket",
      objectKey: run.resultsS3Key,
      contentDisposition: 'attachment; filename="benchmark-results-bench_with_unsafe_chars.jsonl"',
      expiresInSeconds: 900
    },
    {
      bucketName: "benchmark-bucket",
      objectKey: run.reportS3Key,
      contentDisposition: 'attachment; filename="benchmark-report-bench_with_unsafe_chars.md"',
      expiresInSeconds: 900
    }
  ])
})

test("BenchmarkArtifactDownloadService preserves missing key and bucket errors and clamps S3 TTL", async () => {
  const run = benchmarkRun("tenant-a", "run-1")
  const signInputs: Array<Parameters<BenchmarkArtifactDownloadPorts["signArtifact"]>[0]> = []
  const missingKeyService = fixture([run], { bucketName: "benchmark-bucket" })
  assert.equal(await missingKeyService.createDownload(actor("tenant-a"), run.runId, "summary"), undefined)

  const missingBucketService = fixture([{ ...run, summaryS3Key: "runs/run-1/summary.json" }], { bucketName: "" })
  await assert.rejects(
    () => missingBucketService.createDownload(actor("tenant-a"), run.runId, "summary"),
    /BENCHMARK_BUCKET_NAME is not configured/
  )

  const ttlService = fixture([{ ...run, summaryS3Key: "runs/run-1/summary.json" }], {
    downloadExpiresInSeconds: 15,
    signArtifact: async (input) => {
      signInputs.push(input)
      return "https://signed.invalid/summary"
    }
  })
  assert.equal((await ttlService.createDownload(actor("tenant-a"), run.runId, "summary"))?.expiresInSeconds, 60)
  assert.equal(signInputs[0]?.expiresInSeconds, 60)
})

test("BenchmarkArtifactDownloadService propagates signer failures without returning a URL", async () => {
  const run = { ...benchmarkRun("tenant-a", "run-1"), reportS3Key: "runs/run-1/report.md" }
  const service = fixture([run], {
    signArtifact: async () => { throw new Error("S3 presign failed") }
  })

  await assert.rejects(
    () => service.createDownload(actor("tenant-a"), run.runId, "report"),
    /S3 presign failed/
  )
})

test("createBenchmarkArtifactDownloadMetadata preserves artifact extensions and sanitizes the file name", () => {
  assert.deepEqual(createBenchmarkArtifactDownloadMetadata("bench/with:unsafe*chars", "report", "runs/bench/report.md"), {
    fileName: "benchmark-report-bench_with_unsafe_chars.md",
    objectKey: "runs/bench/report.md",
    contentDisposition: 'attachment; filename="benchmark-report-bench_with_unsafe_chars.md"'
  })
  assert.equal(createBenchmarkArtifactDownloadMetadata("bench-1", "summary", "summary.json").fileName, "benchmark-summary-bench-1.json")
  assert.equal(createBenchmarkArtifactDownloadMetadata("bench-1", "results", "results.jsonl").fileName, "benchmark-results-bench-1.jsonl")
})

function fixture(
  runs: BenchmarkRun[],
  overrides: Partial<Omit<BenchmarkArtifactDownloadPorts, "benchmarkRunStore" | "tenantIdForActor">> = {}
): BenchmarkArtifactDownloadService {
  return new BenchmarkArtifactDownloadService({
    benchmarkRunStore: {
      get: async (tenantId, runId) => runs.find((run) => run.tenantId === tenantId && run.runId === runId)
    },
    tenantIdForActor: (value) => {
      if (!value.tenantId) throw new Error("authoritative tenant required")
      return value.tenantId
    },
    signArtifact: overrides.signArtifact ?? (async () => "https://signed.invalid"),
    bucketName: overrides.bucketName ?? "benchmark-bucket",
    downloadExpiresInSeconds: overrides.downloadExpiresInSeconds ?? 900
  })
}

function actor(tenantId: string): AppUser {
  return { userId: `user-${tenantId}`, cognitoGroups: [], accountStatus: "active", tenantId }
}

function benchmarkRun(tenantId: string, runId: string): BenchmarkRun {
  return {
    runId,
    status: "queued",
    mode: "agent",
    runner: "codebuild",
    suiteId: "standard-agent-v1",
    datasetS3Key: "datasets/agent/standard-v1.jsonl",
    createdBy: `user-${tenantId}`,
    tenantId,
    createdAt: "2026-07-17T00:00:00.000Z",
    updatedAt: "2026-07-17T00:00:00.000Z"
  }
}
