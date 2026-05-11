export function extractSignalTerms(text: string, limit = 8): string[] {
  const normalized = text.normalize("NFKC")
  const candidates = collectCandidates(normalized)
  return unique(
    candidates
      .map((candidate) => ({ ...candidate, score: scoreSignalTerm(candidate, candidates.length) }))
      .filter((candidate) => candidate.score >= 2)
      .map((candidate) => candidate.term)
  ).slice(0, limit)
}

export function buildSignalPhrase(texts: string[], fallback: string, limit = 6): string {
  const terms = unique(texts.flatMap((text) => extractSignalTerms(text, limit))).slice(0, limit)
  return terms.length > 0 ? terms.join(" ") : fallback.normalize("NFKC").replace(/\s+/g, " ").trim()
}

type SignalCandidate = {
  term: string
  index: number
  kind: "ascii" | "cjk"
}

function collectCandidates(text: string): SignalCandidate[] {
  const candidates: SignalCandidate[] = []
  const asciiMatches = [...text.matchAll(/[A-Za-z][A-Za-z0-9_-]*/g)]
  for (const match of asciiMatches) {
    const term = match[0].trim()
    if (term) candidates.push({ term, index: match.index ?? 0, kind: "ascii" })
  }

  const cjkMatches = [...text.matchAll(/[\p{Script=Han}\p{Script=Katakana}ー]{2,}|[\p{Script=Hiragana}]{3,}/gu)]
  for (const match of cjkMatches) {
    const term = match[0].trim()
    if (term) candidates.push({ term, index: match.index ?? 0, kind: "cjk" })
  }

  return candidates.sort((a, b) => a.index - b.index)
}

function scoreSignalTerm(candidate: SignalCandidate, candidateCount: number): number {
  if (candidate.kind === "cjk") return scoreCjkSignal(candidate.term)
  return scoreAsciiSignal(candidate.term, candidate.index, candidateCount)
}

function scoreAsciiSignal(term: string, index: number, candidateCount: number): number {
  if (term.length < 3) return 0
  let score = 0
  const hasStructuralMarker = /[0-9_-]/.test(term)
  const isAcronymLike = /^[A-Z0-9_-]{2,}$/.test(term) && /[A-Z]/.test(term)
  if (hasStructuralMarker) score += 3
  if (isAcronymLike) score += 3
  if (term.length >= 8) score += 3
  else if (term.length >= 6) score += 2
  else if (term.length >= 4) score += 1
  if (/^[a-z]+$/.test(term) && term.length <= 4) score -= 1
  if (/^[A-Z][a-z]+$/.test(term) && term.length <= 4 && index === 0 && candidateCount > 1) score -= 2
  return score
}

function scoreCjkSignal(term: string): number {
  if (term.length <= 1) return 0
  if (/^[ぁ-ん]+$/u.test(term) && term.length < 4) return 0
  return term.length >= 3 ? 3 : 2
}

function unique<T>(items: T[]): T[] {
  return [...new Set(items)]
}
