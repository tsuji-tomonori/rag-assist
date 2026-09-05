import type { BenchmarkRunStore } from "../adapters/benchmark-run-store.js"
import type {
  RevocationCleanupDriver,
  RevocationCleanupScope,
  RevocationCleanupTargetReference
} from "../rag/_shared/security/revocation-cleanup-coordinator.js"
import { tenantPartitionId } from "../security/tenant-partition.js"
import type { BenchmarkRun } from "../types.js"

export type BenchmarkArtifactRevocationCleanupPorts = {
  benchmarkRunStore: Pick<BenchmarkRunStore, "get">
  artifactStore?: {
    deleteObject(key: string): Promise<void>
    listKeys(prefix: string): Promise<string[]>
  }
}

export class BenchmarkArtifactRevocationCleanupDriverFactory {
  constructor(private readonly ports: BenchmarkArtifactRevocationCleanupPorts) {}

  knownTargets(run: BenchmarkRun): RevocationCleanupTargetReference[] {
    const prefix = benchmarkRunArtifactPrefix(run)
    return ["results.jsonl", "summary.json", "report.md", "release-audit.json"].map((fileName) => ({
      scope: "evaluation_artifact",
      reference: `${prefix}${fileName}`
    }))
  }

  create(run: BenchmarkRun): RevocationCleanupDriver {
    const targets = this.knownTargets(run)
    const allowedReferences = new Set(targets.map((target) => target.reference))
    const prefix = benchmarkRunArtifactPrefix(run)

    return {
      isAuthoritativeDenyCurrent: async (manifest) => {
        const current = await this.ports.benchmarkRunStore.get(run.tenantId, run.runId)
        return current?.status === "failed"
          && current.errorCode === "permission_revoked"
          && current.updatedAt === manifest.authoritativeDeny.version
      },
      discover: async (_manifest, scope) => scope === "evaluation_artifact" ? targets : [],
      cleanup: async (_manifest, target) => {
        if (!this.ports.artifactStore) throw new Error("Benchmark artifact cleanup store is unavailable")
        if (target.scope !== "evaluation_artifact" || !allowedReferences.has(target.reference)) {
          throw new Error("Benchmark artifact cleanup target escaped its run partition")
        }
        await this.ports.artifactStore.deleteObject(target.reference)
      },
      findResiduals: async (_manifest, scope: RevocationCleanupScope) => {
        if (scope !== "evaluation_artifact") return []
        if (!this.ports.artifactStore) throw new Error("Benchmark artifact cleanup store is unavailable")
        const existing = new Set(await this.ports.artifactStore.listKeys(prefix))
        return targets.filter((target) => existing.has(target.reference))
      }
    }
  }
}

function benchmarkRunArtifactPrefix(run: Pick<BenchmarkRun, "tenantId" | "runId">): string {
  return `runs/${tenantPartitionId(run.tenantId)}/${run.runId}/`
}
