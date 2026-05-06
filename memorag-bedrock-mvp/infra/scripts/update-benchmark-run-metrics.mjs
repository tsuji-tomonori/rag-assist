#!/usr/bin/env node
import { readFileSync } from "node:fs"
import { pathToFileURL } from "node:url"
import { DynamoDBClient, UpdateItemCommand } from "@aws-sdk/client-dynamodb"

if (isMainModule()) {
  await main()
}

export async function main() {
  const runId = required(process.env.RUN_ID, "RUN_ID")
  const tableName = required(process.env.BENCHMARK_RUNS_TABLE_NAME, "BENCHMARK_RUNS_TABLE_NAME")
  const summaryPath = required(process.env.SUMMARY, "SUMMARY")
  const summary = JSON.parse(readFileSync(summaryPath, "utf-8"))
  const metrics = buildBenchmarkRunMetrics(summary)
  const client = new DynamoDBClient({ region: process.env.AWS_REGION ?? process.env.AWS_DEFAULT_REGION })

  await client.send(new UpdateItemCommand(buildUpdateBenchmarkRunMetricsCommandInput({
    TableName: tableName,
    runId,
    metrics,
    updatedAt: new Date().toISOString()
  })))
}

export function buildUpdateBenchmarkRunMetricsCommandInput({ TableName, runId, metrics, updatedAt }) {
  return {
    TableName,
    Key: { runId: { S: runId } },
    ConditionExpression: "attribute_exists(#runId)",
    UpdateExpression: "SET #metrics = :metrics, #updatedAt = :updatedAt",
    ExpressionAttributeNames: {
      "#runId": "runId",
      "#metrics": "metrics",
      "#updatedAt": "updatedAt"
    },
    ExpressionAttributeValues: {
      ":metrics": dynamoMetricsAttributeValue(metrics),
      ":updatedAt": { S: updatedAt }
    }
  }
}

export function buildBenchmarkRunMetrics(summary) {
  const metrics = summary?.metrics ?? {}
  const total = finiteNumber(summary?.total) ?? 0
  const failedHttp = finiteNumber(summary?.failedHttp) ?? 0
  return compactObject({
    total,
    succeeded: finiteNumber(summary?.succeeded) ?? Math.max(0, total - failedHttp),
    failedHttp,
    answerableAccuracy: finiteNumber(metrics.answerableAccuracy),
    abstentionRecall: finiteNumber(metrics.abstentionRecall),
    citationHitRate: finiteNumber(metrics.citationHitRate),
    expectedFileHitRate: finiteNumber(metrics.expectedFileHitRate),
    retrievalRecallAt20: finiteNumber(metrics.retrievalRecallAt20) ?? finiteNumber(metrics.recallAt20),
    p50LatencyMs: finiteNumber(metrics.p50LatencyMs),
    p95LatencyMs: finiteNumber(metrics.p95LatencyMs),
    averageLatencyMs: finiteNumber(metrics.averageLatencyMs),
    errorRate: finiteNumber(metrics.errorRate) ?? (total > 0 ? failedHttp / total : undefined)
  })
}

export function dynamoMetricsAttributeValue(metrics) {
  return {
    M: Object.fromEntries(
      Object.entries(metrics).map(([key, value]) => [key, { N: String(value) }])
    )
  }
}

function compactObject(input) {
  return Object.fromEntries(
    Object.entries(input).filter(([, value]) => typeof value === "number" && Number.isFinite(value))
  )
}

function finiteNumber(value) {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined
}

function required(value, label) {
  if (!value) throw new Error(`${label} is required`)
  return value
}

function isMainModule() {
  return process.argv[1] ? import.meta.url === pathToFileURL(process.argv[1]).href : false
}
