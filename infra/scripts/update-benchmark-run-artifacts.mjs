#!/usr/bin/env node
import { pathToFileURL } from "node:url"
import { DynamoDBClient, UpdateItemCommand } from "@aws-sdk/client-dynamodb"
import { marshall } from "@aws-sdk/util-dynamodb"

export const REQUIRED_BENCHMARK_ARTIFACT_KINDS = ["results", "summary", "report", "release_audit"]
const FINAL_ARTIFACT_STATUSES = new Set(["available", "generation_failed", "upload_failed"])

if (isMainModule()) await main()

export async function main() {
  const storageRunId = required(process.env.STORAGE_RUN_ID, "STORAGE_RUN_ID")
  const tableName = required(process.env.BENCHMARK_RUNS_TABLE_NAME, "BENCHMARK_RUNS_TABLE_NAME")
  const integrity = buildBenchmarkArtifactIntegrity({
    results: requiredArtifactStatus(process.env.RESULTS_ARTIFACT_STATUS, "RESULTS_ARTIFACT_STATUS"),
    summary: requiredArtifactStatus(process.env.SUMMARY_ARTIFACT_STATUS, "SUMMARY_ARTIFACT_STATUS"),
    report: requiredArtifactStatus(process.env.REPORT_ARTIFACT_STATUS, "REPORT_ARTIFACT_STATUS"),
    release_audit: requiredArtifactStatus(process.env.RELEASE_AUDIT_ARTIFACT_STATUS, "RELEASE_AUDIT_ARTIFACT_STATUS")
  })
  const client = new DynamoDBClient({ region: process.env.AWS_REGION ?? process.env.AWS_DEFAULT_REGION })
  await client.send(new UpdateItemCommand(buildUpdateBenchmarkRunArtifactsCommandInput({
    TableName: tableName,
    storageRunId,
    integrity,
    updatedAt: new Date().toISOString()
  })))
  if (process.env.CODEBUILD_BUILD_SUCCEEDING !== "1" || integrity.status !== "complete") {
    console.error("benchmark_run_or_artifacts_incomplete")
    process.exitCode = 1
  }
}

export function buildBenchmarkArtifactIntegrity(statusByKind) {
  const artifacts = REQUIRED_BENCHMARK_ARTIFACT_KINDS.map((kind) => {
    const status = requiredArtifactStatus(statusByKind?.[kind], kind)
    return {
      kind,
      status,
      ...(status === "generation_failed" ? { failureReason: `${kind}_not_generated` } : {}),
      ...(status === "upload_failed" ? { failureReason: `${kind}_upload_failed` } : {})
    }
  })
  const availableCount = artifacts.filter((artifact) => artifact.status === "available").length
  const failureCount = artifacts.length - availableCount
  return {
    schemaVersion: 1,
    status: failureCount === 0 ? "complete" : availableCount > 0 ? "partial_failure" : "failed",
    availableCount,
    failureCount,
    artifacts
  }
}

export function buildUpdateBenchmarkRunArtifactsCommandInput({ TableName, storageRunId, integrity, updatedAt }) {
  return {
    TableName,
    Key: { runId: { S: storageRunId } },
    ConditionExpression: "attribute_exists(#runId) AND #status = :running",
    UpdateExpression: "SET artifactIntegrity = :artifactIntegrity, #updatedAt = :updatedAt",
    ExpressionAttributeNames: {
      "#runId": "runId",
      "#status": "status",
      "#updatedAt": "updatedAt"
    },
    ExpressionAttributeValues: marshall({
      ":running": "running",
      ":artifactIntegrity": integrity,
      ":updatedAt": updatedAt
    })
  }
}

function requiredArtifactStatus(value, label) {
  if (typeof value !== "string" || !FINAL_ARTIFACT_STATUSES.has(value)) {
    throw new Error(`${label} must be an explicit final benchmark artifact status`)
  }
  return value
}

function required(value, label) {
  if (!value) throw new Error(`${label} is required`)
  return value
}

function isMainModule() {
  return Boolean(process.argv[1]) && import.meta.url === pathToFileURL(process.argv[1]).href
}
