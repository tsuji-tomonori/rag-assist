import type { BenchmarkRunStore } from "../adapters/benchmark-run-store.js"
import type { AppUser } from "../auth.js"
import type { BenchmarkRun } from "../types.js"

export type BenchmarkDownloadArtifact = "report" | "summary" | "results" | "logs"
export type BenchmarkStoredArtifact = Exclude<BenchmarkDownloadArtifact, "logs">

export type BenchmarkArtifactSignInput = {
  bucketName: string
  objectKey: string
  contentDisposition: string
  expiresInSeconds: number
}

export type BenchmarkArtifactDownloadPorts = {
  benchmarkRunStore: Pick<BenchmarkRunStore, "get">
  tenantIdForActor: (actor: AppUser) => string
  signArtifact: (input: BenchmarkArtifactSignInput) => Promise<string>
  bucketName: string
  downloadExpiresInSeconds: number
}

export type BenchmarkArtifactDownload = {
  url: string
  expiresInSeconds: number
  objectKey: string
}

export class BenchmarkArtifactDownloadService {
  constructor(private readonly ports: BenchmarkArtifactDownloadPorts) {}

  async createDownload(
    actor: AppUser,
    runId: string,
    artifact: BenchmarkDownloadArtifact
  ): Promise<BenchmarkArtifactDownload | undefined> {
    const run = await this.ports.benchmarkRunStore.get(this.ports.tenantIdForActor(actor), runId)
    if (!run) return undefined

    if (artifact === "logs") {
      if (!run.codeBuildLogUrl) return undefined
      return {
        url: run.codeBuildLogUrl,
        expiresInSeconds: this.ports.downloadExpiresInSeconds,
        objectKey: run.codeBuildBuildId ?? run.runId
      }
    }

    if (!this.ports.bucketName) throw new Error("BENCHMARK_BUCKET_NAME is not configured")
    const objectKey = artifactObjectKey(run, artifact)
    if (!objectKey) return undefined

    const expiresInSeconds = Math.max(60, this.ports.downloadExpiresInSeconds)
    const downloadMetadata = createBenchmarkArtifactDownloadMetadata(runId, artifact, objectKey)
    const url = await this.ports.signArtifact({
      bucketName: this.ports.bucketName,
      objectKey: downloadMetadata.objectKey,
      contentDisposition: downloadMetadata.contentDisposition,
      expiresInSeconds
    })
    return { url, expiresInSeconds, objectKey }
  }
}

function artifactObjectKey(
  run: BenchmarkRun,
  artifact: BenchmarkStoredArtifact
): string | undefined {
  if (artifact === "summary") return run.summaryS3Key
  if (artifact === "results") return run.resultsS3Key
  return run.reportS3Key
}

function artifactExtension(artifact: BenchmarkStoredArtifact): string {
  if (artifact === "report") return ".md"
  if (artifact === "summary") return ".json"
  return ".jsonl"
}

export function createBenchmarkArtifactDownloadMetadata(
  runId: string,
  artifact: BenchmarkStoredArtifact,
  objectKey: string
): { fileName: string; objectKey: string; contentDisposition: string } {
  const fileName = `benchmark-${artifact}-${runId.replace(/[^a-zA-Z0-9._-]/g, "_")}${artifactExtension(artifact)}`
  return {
    fileName,
    objectKey,
    contentDisposition: `attachment; filename="${fileName}"`
  }
}
