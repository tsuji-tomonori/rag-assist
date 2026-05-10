export type DrawingValueKind = "scale" | "dimension" | "diameter" | "length" | "range"

export type NormalizedDrawingValue = {
  kind: DrawingValueKind
  raw: string
  canonical: string
  value: number
  unit?: "mm" | "m" | "ratio"
  operator?: ">=" | ">" | "<=" | "<" | "="
  diameterClass?: "phi" | "d" | "a"
}

const unitsToMillimeters = new Map([
  ["mm", 1],
  ["cm", 10],
  ["m", 1000]
])

const unitsToMeters = new Map([
  ["m", 1],
  ["cm", 0.01],
  ["mm", 0.001]
])

const rangeOperatorLexicon = new Map<string, NonNullable<NormalizedDrawingValue["operator"]>>([
  ["以上", ">="],
  ["≧", ">="],
  [">=", ">="],
  ["超", ">"],
  ["より大きい", ">"],
  [">", ">"],
  ["以下", "<="],
  ["以内", "<="],
  ["≦", "<="],
  ["<=", "<="],
  ["未満", "<"],
  ["より小さい", "<"],
  ["<", "<"]
])

type QuantityToken = {
  value: number
  unit?: string
  raw: string
  start: number
  end: number
}

type OperatorToken = {
  operator: NonNullable<NormalizedDrawingValue["operator"]>
  raw: string
  start: number
  end: number
}

export function normalizeScale(text: string): NormalizedDrawingValue | null {
  const normalized = normalizeText(text)
  const ratio = normalized.match(/(?:縮尺|S)\s*[:=]?\s*1\s*[/：:]\s*(\d{1,5})/iu) ?? normalized.match(/\b1\s*[/：:]\s*(\d{1,5})\b/u)
  if (!ratio) return null
  const denominator = Number(ratio[1])
  if (!Number.isFinite(denominator) || denominator <= 0) return null
  return {
    kind: "scale",
    raw: ratio[0],
    canonical: `scale:1/${denominator}`,
    value: denominator,
    unit: "ratio",
    operator: "="
  }
}

export function normalizeDimension(text: string): NormalizedDrawingValue | null {
  const normalized = normalizeText(text)
  const match = normalized.match(/(-?\d+(?:\.\d+)?)\s*(mm|m|cm)\b/iu)
  if (!match) return null
  const value = Number(match[1])
  const unit = match[2]?.toLowerCase()
  const millimeters = toMillimeters(value, unit)
  if (millimeters === null) return null
  return {
    kind: "dimension",
    raw: match[0],
    canonical: `dimension:mm:${formatNumber(millimeters)}`,
    value: millimeters,
    unit: "mm",
    operator: "="
  }
}

export function normalizeDiameter(text: string): NormalizedDrawingValue | null {
  const normalized = normalizeText(text)
  const match =
    normalized.match(/(?:\b(?:VP|VU|SGP)\s*)?[φΦ]\s*(\d+(?:\.\d+)?)/iu) ??
    normalized.match(/\bD\s*[=]?\s*(\d+(?:\.\d+)?)/iu) ??
    normalized.match(/\b(\d+(?:\.\d+)?)\s*A\b/iu)
  if (!match) return null
  const value = Number(match[1])
  if (!Number.isFinite(value)) return null
  const raw = match[0]
  const diameterClass: NormalizedDrawingValue["diameterClass"] = /A\b/iu.test(raw) ? "a" : /^\s*D/iu.test(raw) ? "d" : "phi"
  return {
    kind: "diameter",
    raw,
    canonical: `diameter:${diameterClass}:${formatNumber(value)}`,
    value,
    diameterClass,
    operator: "="
  }
}

export function normalizeLength(text: string): NormalizedDrawingValue | null {
  const normalized = normalizeText(text)
  const match = normalized.match(/(?:\bL|延長)\s*(?:は)?\s*[=:]?\s*(-?\d+(?:\.\d+)?)\s*(m|mm|cm)\b/iu)
  if (!match) return null
  const value = Number(match[1])
  const unit = match[2]?.toLowerCase()
  const meters = toMeters(value, unit)
  if (meters === null) return null
  return {
    kind: "length",
    raw: match[0],
    canonical: `length:m:${formatNumber(meters)}`,
    value: meters,
    unit: "m",
    operator: "="
  }
}

export function normalizeRange(text: string): NormalizedDrawingValue | null {
  const normalized = normalizeText(text)
  const candidate = firstRangeCandidate(normalized)
  if (!candidate) return null
  const millimeters = toMillimeters(candidate.quantity.value, candidate.quantity.unit ?? "mm")
  if (millimeters === null) return null
  return {
    kind: "range",
    raw: candidate.raw,
    canonical: `range:${candidate.operator.operator}:mm:${formatNumber(millimeters)}`,
    value: millimeters,
    unit: "mm",
    operator: candidate.operator.operator
  }
}

export function extractDrawingValues(text: string): NormalizedDrawingValue[] {
  const values: NormalizedDrawingValue[] = []
  const parsers = [normalizeScale, normalizeLength, normalizeDiameter, normalizeRange]
  for (const parser of parsers) {
    const value = parser(text)
    if (value) values.push(value)
  }
  const dimension = normalizeDimension(text)
  if (dimension && !values.some((value) => value.kind === "length" && value.raw.includes(dimension.raw))) values.push(dimension)
  return dedupeValues(values)
}

export function normalizeExpectedDrawingValue(value: string | { raw?: string; canonical?: string; kind?: DrawingValueKind }): string | null {
  if (typeof value === "string") return normalizeExpectedText(value)
  if (value.canonical) return value.canonical
  if (value.raw) {
    const normalized = normalizeExpectedText(value.raw, value.kind)
    if (normalized) return normalized
  }
  return null
}

export function normalizedDrawingValuesMatch(expected: string[], answer: string, evidenceText = ""): boolean | null {
  const normalizedExpected = expected.map((value) => isCanonicalValue(value) ? value : normalizeExpectedText(value)).filter((value): value is string => Boolean(value))
  if (normalizedExpected.length === 0) return null
  const observed = new Set(extractDrawingValues(`${answer}\n${evidenceText}`).map((value) => value.canonical))
  return normalizedExpected.every((value) => observed.has(value))
}

function isCanonicalValue(value: string): boolean {
  return /^(?:scale:1\/\d+|dimension:mm:-?\d+(?:\.\d+)?|diameter:(?:phi|d|a):\d+(?:\.\d+)?|length:m:-?\d+(?:\.\d+)?|range:(?:>=|>|<=|<):mm:-?\d+(?:\.\d+)?)$/u.test(value)
}

function normalizeExpectedText(text: string, kind?: DrawingValueKind): string | null {
  const parsers = kind ? parserFor(kind) : undefined
  if (parsers) return parsers(text)?.canonical ?? null
  return extractDrawingValues(text)[0]?.canonical ?? null
}

function parserFor(kind: DrawingValueKind): ((text: string) => NormalizedDrawingValue | null) | undefined {
  if (kind === "scale") return normalizeScale
  if (kind === "dimension") return normalizeDimension
  if (kind === "diameter") return normalizeDiameter
  if (kind === "length") return normalizeLength
  if (kind === "range") return normalizeRange
  return undefined
}

function normalizeText(text: string): string {
  return text.normalize("NFKC").replace(/\s+/g, " ").trim()
}

function toMillimeters(value: number, unit: string | undefined): number | null {
  if (!Number.isFinite(value)) return null
  const factor = unitsToMillimeters.get(unit ?? "")
  return factor === undefined ? null : value * factor
}

function toMeters(value: number, unit: string | undefined): number | null {
  if (!Number.isFinite(value)) return null
  const factor = unitsToMeters.get(unit ?? "")
  return factor === undefined ? null : value * factor
}

function firstRangeCandidate(text: string): { quantity: QuantityToken; operator: OperatorToken; raw: string } | undefined {
  const quantities = quantityTokens(text)
  const operators = operatorTokens(text, rangeOperatorLexicon)
  for (const quantity of quantities) {
    const after = operators.find((operator) => operator.start >= quantity.end && isConnectorOnly(text.slice(quantity.end, operator.start)))
    if (after) return { quantity, operator: after, raw: text.slice(quantity.start, after.end) }
    const before = operators.find((operator) => operator.end <= quantity.start && isConnectorOnly(text.slice(operator.end, quantity.start)))
    if (before) return { quantity, operator: before, raw: text.slice(before.start, quantity.end) }
  }
  return undefined
}

function quantityTokens(text: string): QuantityToken[] {
  const tokens: QuantityToken[] = []
  const matcher = /-?\d+(?:\.\d+)?/gu
  for (const match of text.matchAll(matcher)) {
    const rawNumber = match[0]
    const start = match.index
    if (start === undefined) continue
    const numericEnd = start + rawNumber.length
    const unit = unitAfter(text, numericEnd)
    const end = unit ? unit.end : numericEnd
    const value = Number(rawNumber)
    if (Number.isFinite(value)) tokens.push({ value, unit: unit?.unit, raw: text.slice(start, end), start, end })
  }
  return tokens
}

function operatorTokens(text: string, lexicon: Map<string, NonNullable<NormalizedDrawingValue["operator"]>>): OperatorToken[] {
  const tokens: OperatorToken[] = []
  const surfaces = [...lexicon.keys()].sort((left, right) => right.length - left.length)
  for (const surface of surfaces) {
    const operator = lexicon.get(surface)
    if (!operator) continue
    let start = text.indexOf(surface)
    while (start >= 0) {
      tokens.push({ operator, raw: surface, start, end: start + surface.length })
      start = text.indexOf(surface, start + surface.length)
    }
  }
  return tokens.sort((left, right) => left.start - right.start || right.raw.length - left.raw.length)
}

function unitAfter(text: string, offset: number): { unit: string; end: number } | undefined {
  const rest = text.slice(offset).trimStart()
  const whitespace = text.slice(offset).length - rest.length
  const units = [...unitsToMillimeters.keys()].sort((left, right) => right.length - left.length)
  const unit = units.find((candidate) => rest.toLowerCase().startsWith(candidate))
  return unit ? { unit, end: offset + whitespace + unit.length } : undefined
}

function isConnectorOnly(value: string): boolean {
  const trimmed = value.trim()
  return trimmed === "" || trimmed === "=" || trimmed === ":" || trimmed === "は"
}

function formatNumber(value: number): string {
  return Number(value.toFixed(6)).toString()
}

function dedupeValues(values: NormalizedDrawingValue[]): NormalizedDrawingValue[] {
  const seen = new Set<string>()
  return values.filter((value) => {
    if (seen.has(value.canonical)) return false
    seen.add(value.canonical)
    return true
  })
}
