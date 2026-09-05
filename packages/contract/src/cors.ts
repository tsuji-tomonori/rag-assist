export type CorsOriginMode = "production" | "non-production"

export const DEPLOYMENT_ENVIRONMENTS = [
  "local",
  "test",
  "dev",
  "preview",
  "staging",
  "prod",
  "production"
] as const

export type DeploymentEnvironment = typeof DEPLOYMENT_ENVIRONMENTS[number]

export type ParseCorsAllowedOriginsOptions = {
  readonly mode: CorsOriginMode
  readonly requireSingleOrigin?: boolean
  readonly allowWildcard?: boolean
}

const validProtocols = new Set(["http:", "https:"])

function isLoopbackHostname(hostname: string): boolean {
  return hostname === "localhost" ||
    hostname.endsWith(".localhost") ||
    hostname === "::1" ||
    hostname === "[::1]" ||
    hostname.startsWith("127.")
}

function invalidOrigin(value: string): Error {
  return new Error(`CORS_ALLOWED_ORIGINS contains an invalid origin: ${value}`)
}

export function parseCorsAllowedOrigins(
  rawValue: string | undefined,
  options: ParseCorsAllowedOriginsOptions
): readonly string[] {
  if (rawValue === undefined || rawValue.trim().length === 0) {
    if (options.mode === "production") {
      throw new Error("CORS_ALLOWED_ORIGINS is required in production")
    }
    return []
  }

  const origins = rawValue.split(",").map((value) => value.trim())
  if (origins.some((value) => value.length === 0)) {
    throw new Error("CORS_ALLOWED_ORIGINS must not contain blank entries")
  }

  if (origins.includes("*")) {
    const allowWildcard = options.allowWildcard ?? options.mode === "non-production"
    if (!allowWildcard) {
      throw new Error("CORS_ALLOWED_ORIGINS must not include * for this environment")
    }
    if (origins.length !== 1) {
      throw new Error("CORS_ALLOWED_ORIGINS wildcard must be the only entry")
    }
    return ["*"]
  }

  const normalizedOrigins = origins.map((value) => {
    let parsed: URL
    try {
      parsed = new URL(value)
    } catch {
      throw invalidOrigin(value)
    }
    if (
      !validProtocols.has(parsed.protocol) ||
      (options.mode === "production" && parsed.protocol !== "https:") ||
      parsed.username ||
      parsed.password ||
      parsed.origin !== value ||
      (options.mode === "production" && isLoopbackHostname(parsed.hostname))
    ) {
      throw invalidOrigin(value)
    }
    return parsed.origin
  })

  if (new Set(normalizedOrigins).size !== normalizedOrigins.length) {
    throw new Error("CORS_ALLOWED_ORIGINS must not contain duplicate origins")
  }
  if (options.requireSingleOrigin && normalizedOrigins.length !== 1) {
    throw new Error("CORS_ALLOWED_ORIGINS must contain exactly one origin")
  }

  return normalizedOrigins
}

export function parseDeploymentEnvironment(
  rawValue: string | undefined,
  defaultValue: DeploymentEnvironment
): DeploymentEnvironment {
  const value = rawValue ?? defaultValue
  if ((DEPLOYMENT_ENVIRONMENTS as readonly string[]).includes(value)) {
    return value as DeploymentEnvironment
  }
  throw new Error(`DEPLOYMENT_ENVIRONMENT must be one of: ${DEPLOYMENT_ENVIRONMENTS.join(", ")}`)
}

export function isProductionDeploymentEnvironment(value: DeploymentEnvironment): boolean {
  return value === "prod" || value === "production"
}
