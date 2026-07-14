import { config } from "../../../config.js"
import type { Dependencies } from "../../../dependencies.js"
import type { Chunk, DocumentManifest, StructuredBlock } from "../../../types.js"
import { chunkDocumentWithPolicy, chunkStructuredBlocks, chunkText } from "../../offline/pre-retrieval/chunking/chunker.service.js"

type ObjectStoreDeps = Pick<Dependencies, "objectStore">

export async function loadChunksForManifest(deps: ObjectStoreDeps, manifest: DocumentManifest): Promise<Chunk[]> {
  const blocks = await loadStructuredBlocksForManifest(deps, manifest)
  const source = await deps.objectStore.getText(manifest.sourceObjectKey)
  if (manifest.documentVersion && manifest.chunkingPolicy) {
    const result = chunkDocumentWithPolicy({
      text: source,
      blocks,
      documentVersion: manifest.documentVersion,
      policy: manifest.chunkingPolicy
    })
    if (!result.publicationEligible) throw new Error(`Stored chunk policy cannot be reproduced: ${result.violations.map((violation) => violation.code).join(",")}`)
    const expectedIds = (manifest.chunks ?? []).map((chunk) => chunk.id)
    if (expectedIds.length > 0 && !sameStrings(expectedIds, result.chunks.map((chunk) => chunk.id))) {
      throw new Error("Stored chunk manifest does not reconcile with its versioned policy")
    }
    return hydrateChunkMetadata(result.chunks, manifest)
  }
  if (blocks?.length) return hydrateChunkMetadata(chunkStructuredBlocks(blocks, config.chunkSizeChars, config.chunkOverlapChars), manifest)
  return hydrateChunkMetadata(chunkText(source, config.chunkSizeChars, config.chunkOverlapChars), manifest)
}

export async function loadStructuredBlocksForManifest(
  deps: ObjectStoreDeps,
  manifest: DocumentManifest
): Promise<StructuredBlock[] | undefined> {
  if (!manifest.structuredBlocksObjectKey) return undefined
  try {
    const raw = JSON.parse(await deps.objectStore.getText(manifest.structuredBlocksObjectKey)) as { blocks?: StructuredBlock[] }
    return Array.isArray(raw.blocks) ? raw.blocks : undefined
  } catch (err) {
    if (!isMissingObjectError(err)) throw err
    return undefined
  }
}

function isMissingObjectError(err: unknown): boolean {
  if (!(err instanceof Error)) return false
  return err.message.includes("not found") || err.message.includes("NoSuchKey") || err.name === "NoSuchKey"
}

function sameStrings(left: string[], right: string[]): boolean {
  return left.length === right.length && left.every((value, index) => value === right[index])
}

function hydrateChunkMetadata(chunks: Chunk[], manifest: DocumentManifest): Chunk[] {
  if (!manifest.chunks?.length) return chunks
  const metadataById = new Map(manifest.chunks.map((chunk) => [chunk.id, chunk]))
  return chunks.map((chunk) => {
    const metadata = metadataById.get(chunk.id)
    return metadata ? { ...chunk, ...metadata, text: chunk.text } : chunk
  })
}
