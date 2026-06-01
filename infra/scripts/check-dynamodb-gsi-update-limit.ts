#!/usr/bin/env node
import { readFileSync } from "node:fs"
import {
  findDynamoDbGsiUpdateLimitViolations,
  type DynamoDbGsiUpdateLimitViolation
} from "../lib/dynamodb-gsi-update-limit"

function readJson(path: string) {
  return JSON.parse(readFileSync(path, "utf8"))
}

function formatViolation(violation: DynamoDbGsiUpdateLimitViolation) {
  const added = violation.added.length > 0 ? violation.added.join(", ") : "-"
  const removed = violation.removed.length > 0 ? violation.removed.join(", ") : "-"
  return [
    `- ${violation.logicalId}: ${violation.createDeleteChangeCount} GSI create/delete changes`,
    `  added: ${added}`,
    `  removed: ${removed}`
  ].join("\n")
}

export function main(argv = process.argv.slice(2)) {
  const [previousTemplatePath, nextTemplatePath] = argv
  if (!previousTemplatePath || !nextTemplatePath) {
    console.error("Usage: check-dynamodb-gsi-update-limit.ts <previous-template.json> <next-template.json>")
    return 2
  }

  const violations = findDynamoDbGsiUpdateLimitViolations(
    readJson(previousTemplatePath),
    readJson(nextTemplatePath)
  )

  if (violations.length === 0) {
    console.log("DynamoDB GSI update limit guard passed.")
    return 0
  }

  console.error([
    "DynamoDB GSI update limit guard failed.",
    "CloudFormation/DynamoDB can fail when an existing AWS::DynamoDB::Table update creates or deletes more than one GSI in a single deployment.",
    `Previous template: ${previousTemplatePath}`,
    `Next template: ${nextTemplatePath}`,
    "",
    ...violations.map(formatViolation)
  ].join("\n"))
  return 1
}

if (require.main === module) {
  process.exitCode = main()
}
