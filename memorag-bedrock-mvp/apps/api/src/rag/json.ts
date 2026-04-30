export function parseJsonObject<T>(raw: string): T | undefined {
  const trimmed = raw.trim()
  const candidates = [
    trimmed,
    trimmed.replace(/^```json\s*/i, "").replace(/```$/i, "").trim(),
    extractFirstJson(trimmed)
  ].filter(Boolean) as string[]

  for (const candidate of candidates) {
    try {
      return JSON.parse(candidate) as T
    } catch {
      // Try next candidate.
    }
  }
  return undefined
}

function extractFirstJson(raw: string): string | undefined {
  const first = raw.indexOf("{")
  const last = raw.lastIndexOf("}")
  if (first < 0 || last <= first) return undefined
  return raw.slice(first, last + 1)
}
