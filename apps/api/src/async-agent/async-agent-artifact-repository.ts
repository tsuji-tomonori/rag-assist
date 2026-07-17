import type { ObjectStore } from "../adapters/object-store.js"
import { tenantPartitionId } from "../security/tenant-partition.js"
import type { AsyncAgentRun } from "../types.js"

type PersistedArtifact = AsyncAgentRun["artifacts"][number]

export type AsyncAgentArtifactInput = {
  artifactType: PersistedArtifact["artifactType"]
  fileName: string
  mimeType: string
  text: string
  writebackStatus?: PersistedArtifact["writebackStatus"]
}

export type AsyncAgentArtifactRepositoryPorts = {
  objectStore: Pick<ObjectStore, "putText" | "deleteObject">
  createArtifactId: () => string
  sanitizeText: (text: string) => string
}

export class AsyncAgentArtifactRepository {
  constructor(private readonly ports: AsyncAgentArtifactRepositoryPorts) {}

  async persist(
    run: Pick<AsyncAgentRun, "tenantId" | "agentRunId">,
    artifacts: readonly AsyncAgentArtifactInput[],
    createdAt: string,
    logText?: string
  ): Promise<AsyncAgentRun["artifacts"]> {
    const normalizedArtifacts = [...artifacts]
    if (logText?.trim()) {
      normalizedArtifacts.push({
        artifactType: "log",
        fileName: "provider-log.txt",
        mimeType: "text/plain",
        text: logText,
        writebackStatus: "not_requested"
      })
    }

    return Promise.all(normalizedArtifacts.map(async (artifact) => {
      const artifactId = this.ports.createArtifactId()
      const fileName = sanitizeArtifactFileName(artifact.fileName)
      const storageRef = `${asyncAgentArtifactPrefix(run.tenantId)}${encodeURIComponent(run.agentRunId)}/artifacts/${artifactId}/${fileName}`
      const text = this.ports.sanitizeText(artifact.text)
      await this.ports.objectStore.putText(storageRef, text)
      return {
        artifactId,
        agentRunId: run.agentRunId,
        artifactType: artifact.artifactType,
        fileName,
        mimeType: artifact.mimeType,
        size: Buffer.byteLength(text, "utf-8"),
        storageRef,
        createdAt,
        writebackStatus: artifact.writebackStatus ?? "not_requested"
      }
    }))
  }

  async cleanup(artifacts: readonly Pick<PersistedArtifact, "storageRef">[]): Promise<void> {
    await Promise.all(artifacts.map((artifact) => this.ports.objectStore.deleteObject(artifact.storageRef)))
  }
}

function asyncAgentArtifactPrefix(tenantId: string): string {
  return `agent-runs/${tenantPartitionId(tenantId)}/runs/`
}

function sanitizeArtifactFileName(fileName: string): string {
  const sanitized = fileName.replace(/[^a-zA-Z0-9._-]/g, "_").replace(/^_+/, "")
  return sanitized || "artifact.txt"
}
