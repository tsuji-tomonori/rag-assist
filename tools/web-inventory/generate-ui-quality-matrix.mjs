#!/usr/bin/env node
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { readUiTraceManifest } from "./ui-traceability.mjs"
import {
  formatUiQualityIssues,
  readUiQualityMatrix,
  renderUiQualityMatrix,
  uiQualityMatrixOutputPath,
  validateUiQualityMatrix
} from "./ui-quality-matrix.mjs"

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..")
const checkOnly = process.argv.includes("--check")
const matrix = readUiQualityMatrix(repoRoot)
const traceManifest = readUiTraceManifest(repoRoot)
const issues = validateUiQualityMatrix({ repoRoot, matrix, traceManifest })

if (issues.length > 0) {
  console.error(formatUiQualityIssues(issues))
  process.exitCode = 1
} else {
  const outputPath = path.join(repoRoot, uiQualityMatrixOutputPath)
  const content = renderUiQualityMatrix({ matrix, traceManifest })
  if (checkOnly) {
    if (!fs.existsSync(outputPath) || fs.readFileSync(outputPath, "utf8") !== content) {
      console.error(`${uiQualityMatrixOutputPath} が最新ではありません。npm run docs:web-quality-matrix を実行してください。`)
      process.exitCode = 1
    }
  } else {
    fs.mkdirSync(path.dirname(outputPath), { recursive: true })
    fs.writeFileSync(outputPath, content)
  }
}
