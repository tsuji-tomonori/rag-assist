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
  const match = normalized.match(/(-?\d+(?:\.\d+)?)\s*(mm|m|cm)?\s*(以上|以下|未満|以内|超|より大きい|より小さい|≧|≦|>=|<=|>|<)/u)
  if (!match) return null
  const value = Number(match[1])
  const unit = (match[2] ?? "mm").toLowerCase()
  const millimeters = toMillimeters(value, unit)
  const operator = match[3] ? operatorFor(match[3]) : undefined
  if (millimeters === null || !operator) return null
  return {
    kind: "range",
    raw: match[0],
    canonical: `range:${operator}:mm:${formatNumber(millimeters)}`,
    value: millimeters,
    unit: "mm",
    operator
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
  if (unit === "mm") return value
  if (unit === "cm") return value * 10
  if (unit === "m") return value * 1000
  return null
}

function toMeters(value: number, unit: string | undefined): number | null {
  if (!Number.isFinite(value)) return null
  if (unit === "m") return value
  if (unit === "cm") return value / 100
  if (unit === "mm") return value / 1000
  return null
}

function operatorFor(value: string): NormalizedDrawingValue["operator"] | undefined {
  if (value === "以上" || value === "≧" || value === ">=") return ">="
  if (value === "超" || value === "より大きい" || value === ">") return ">"
  if (value === "以下" || value === "以内" || value === "≦" || value === "<=") return "<="
  if (value === "未満" || value === "より小さい" || value === "<") return "<"
  return undefined
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
