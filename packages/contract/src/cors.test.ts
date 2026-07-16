import assert from "node:assert/strict"
import test from "node:test"
import {
  isProductionDeploymentEnvironment,
  parseCorsAllowedOrigins,
  parseDeploymentEnvironment
} from "./cors.js"

test("production CORS contract accepts one exact HTTPS origin", () => {
  assert.deepEqual(
    parseCorsAllowedOrigins("https://app.example.com", { mode: "production", requireSingleOrigin: true }),
    ["https://app.example.com"]
  )
})

test("production CORS contract fails closed for unset, blank, wildcard, malformed, or multiple origins", () => {
  const invalidValues = [
    undefined,
    "",
    "   ",
    "*",
    "https://app.example.com,*",
    "app.example.com",
    "ftp://app.example.com",
    "http://app.example.com",
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://[::1]:5173",
    "https://user@app.example.com",
    "https://app.example.com/path",
    "https://app.example.com,https://admin.example.com"
  ] as const

  for (const value of invalidValues) {
    assert.throws(
      () => parseCorsAllowedOrigins(value, { mode: "production", requireSingleOrigin: true }),
      /CORS_ALLOWED_ORIGINS/
    )
  }
})

test("deployment environment contract is shared and rejects unknown values", () => {
  assert.equal(parseDeploymentEnvironment(undefined, "dev"), "dev")
  assert.equal(parseDeploymentEnvironment("prod", "dev"), "prod")
  assert.equal(isProductionDeploymentEnvironment("prod"), true)
  assert.equal(isProductionDeploymentEnvironment("production"), true)
  assert.equal(isProductionDeploymentEnvironment("staging"), false)
  assert.throws(() => parseDeploymentEnvironment("prd", "dev"), /DEPLOYMENT_ENVIRONMENT must be one of/)
})

test("non-production CORS contract requires explicit settings and supports explicit exact origins", () => {
  assert.deepEqual(parseCorsAllowedOrigins(undefined, { mode: "non-production" }), [])
  assert.deepEqual(parseCorsAllowedOrigins("", { mode: "non-production" }), [])
  assert.deepEqual(
    parseCorsAllowedOrigins("http://localhost:5173, http://127.0.0.1:5173", { mode: "non-production" }),
    ["http://localhost:5173", "http://127.0.0.1:5173"]
  )
})

test("non-production wildcard must be explicit and cannot be mixed with exact origins", () => {
  assert.deepEqual(parseCorsAllowedOrigins("*", { mode: "non-production" }), ["*"])
  assert.throws(
    () => parseCorsAllowedOrigins("*,http://localhost:5173", { mode: "non-production" }),
    /wildcard must be the only entry/
  )
})

test("deployed non-production CORS contract can forbid wildcard while accepting one explicit local origin", () => {
  assert.deepEqual(
    parseCorsAllowedOrigins("http://localhost:5173", {
      mode: "non-production",
      requireSingleOrigin: true,
      allowWildcard: false
    }),
    ["http://localhost:5173"]
  )
  assert.throws(
    () => parseCorsAllowedOrigins("*", { mode: "non-production", allowWildcard: false }),
    /must not include \*/
  )
})
