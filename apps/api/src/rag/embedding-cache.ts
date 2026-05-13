import { createHash } from "node:crypto"
import type { Dependencies } from "../dependencies.js"

type CachedEmbedding = {
  schemaVersion: 1
  modelId: string
  dimensions: number
  textHash: string
  vector: number[]
  createdAt: string
}

export async function embedWithCache(
  deps: Pick<Dependencies, "objectStore" | "textModel">,
  input: { text: string; modelId: string; dimensions: number }
): Promise<number[]> {
  const textHash = hashText(input.text)
  const key = embeddingCacheKey(input.modelId, input.dimensions, textHash)
  try {
    const cached = JSON.parse(await deps.objectStore.getText(key)) as CachedEmbedding
    if (cached.modelId === input.modelId && cached.dimensions === input.dimensions && cached.textHash === textHash && Array.isArray(cached.vector)) {
      return cached.vector
    }
  } catch {
    // Cache misses and corrupt records fall back to model generation.
  }

  const vector = await deps.textModel.embed(input.text, { modelId: input.modelId, dimensions: input.dimensions })
  const record: CachedEmbedding = {
    schemaVersion: 1,
    modelId: input.modelId,
    dimensions: input.dimensions,
    textHash,
    vector,
    createdAt: new Date().toISOString()
  }
  await deps.objectStore.putText(key, JSON.stringify(record), "application/json")
  return vector
}

export async function mapWithConcurrency<T, R>(items: T[], concurrency: number, fn: (item: T, index: number) => Promise<R>): Promise<R[]> {
  const results: R[] = []
  let nextIndex = 0
  const workers = Array.from({ length: Math.max(1, Math.min(concurrency, items.length || 1)) }, async () => {
    while (nextIndex < items.length) {
      const index = nextIndex
      nextIndex += 1
      const item = items[index]
      if (item !== undefined) results[index] = await fn(item, index)
    }
  })
  await Promise.all(workers)
  return results
}

export function hashText(text: string): string {
  return createHash("sha256").update(text.normalize("NFKC")).digest("hex")
}

function embeddingCacheKey(modelId: string, dimensions: number, textHash: string): string {
  const modelHash = hashText(`${modelId}:${dimensions}`).slice(0, 16)
  return `embedding-cache/${modelHash}/${textHash}.json`
}
