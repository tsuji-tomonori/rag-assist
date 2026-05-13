import { config } from "../config.js"
import type { Dependencies } from "../dependencies.js"
import type { Chunk, DocumentManifest, StructuredBlock } from "../types.js"
import { chunkStructuredBlocks, chunkText } from "./chunk.js"

type ObjectStoreDeps = Pick<Dependencies, "objectStore">

export async function loadChunksForManifest(deps: ObjectStoreDeps, manifest: DocumentManifest): Promise<Chunk[]> {
  const blocks = await loadStructuredBlocksForManifest(deps, manifest)
  if (blocks?.length) return chunkStructuredBlocks(blocks, config.chunkSizeChars, config.chunkOverlapChars)
  const source = await deps.objectStore.getText(manifest.sourceObjectKey)
  return chunkText(source, config.chunkSizeChars, config.chunkOverlapChars)
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
