#!/usr/bin/env node
import { spawnSync } from "node:child_process"
import { readFileSync, rmSync } from "node:fs"
import path from "node:path"

const allowedBoundaries = new Set(["start", "protected_read", "external_side_effect", "durable_commit"])
const boundary = process.argv[2]
const label = process.argv[3] ?? "operation"
if (!allowedBoundaries.has(boundary)) throw new Error("benchmark authorization boundary is invalid")

const functionName = required(process.env.BENCHMARK_AUTHORIZATION_FUNCTION_NAME, "BENCHMARK_AUTHORIZATION_FUNCTION_NAME")
const tenantId = required(process.env.TENANT_ID, "TENANT_ID")
const runId = required(process.env.RUN_ID, "RUN_ID")
const safeLabel = label.replace(/[^A-Za-z0-9_.-]/g, "_")
const responsePath = path.join("/tmp", `benchmark-authorization-${process.pid}-${safeLabel}.json`)

try {
  const result = spawnSync("aws", [
    "lambda",
    "invoke",
    "--function-name",
    functionName,
    "--cli-binary-format",
    "raw-in-base64-out",
    "--payload",
    JSON.stringify({ tenantId, runId, boundary }),
    responsePath
  ], { encoding: "utf-8", stdio: ["ignore", "pipe", "pipe"] })
  if (result.error || result.status !== 0) throw new Error("benchmark_authorization_failed")
  const metadata = parseObject(result.stdout)
  if (metadata.FunctionError) throw new Error("benchmark_authorization_failed")
  const response = parseObject(readFileSync(responsePath, "utf-8"))
  if (
    response.authorized !== true
    || response.boundary !== boundary
    || response.runId !== runId
    || response.tenantId !== tenantId
  ) throw new Error("benchmark_authorization_failed")
} finally {
  rmSync(responsePath, { force: true })
}

function required(value, name) {
  const normalized = value?.trim()
  if (!normalized) throw new Error(`${name} is required`)
  return normalized
}

function parseObject(value) {
  const parsed = JSON.parse(value)
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("benchmark_authorization_failed")
  return parsed
}
