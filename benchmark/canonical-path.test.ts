import assert from "node:assert/strict"
import { readdir, readFile, stat } from "node:fs/promises"
import path from "node:path"
import test from "node:test"
import { fileURLToPath } from "node:url"

const benchmarkDir = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(benchmarkDir, "..")
const legacyRootName = `benchmark${"s"}`
const textExtensions = new Set([".cjs", ".js", ".json", ".jsonl", ".md", ".mjs", ".py", ".sh", ".ts", ".tsx", ".yaml", ".yml"])
const activeDirectories = [".github", "apps", "benchmark", "docs", "infra", "packages", "scripts", "skills", "tools"]
const activeRootFiles = ["AGENTS.md", "README.md", "Taskfile.yml", "package.json"]

async function textFiles(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true })
  const nested = await Promise.all(entries.map(async (entry) => {
    const entryPath = path.join(directory, entry.name)
    if (entry.isDirectory()) return textFiles(entryPath)
    return textExtensions.has(path.extname(entry.name)) ? [entryPath] : []
  }))
  return nested.flat()
}

test("Issue #359 keeps the benchmark workspace as the only repository source root", async () => {
  await assert.rejects(stat(path.join(repoRoot, legacyRootName)), { code: "ENOENT" })

  const files = [
    ...(await Promise.all(activeDirectories.map((directory) => textFiles(path.join(repoRoot, directory))))).flat(),
    ...activeRootFiles.map((file) => path.join(repoRoot, file))
  ]
  const legacyReference = `${legacyRootName}/`
  const unexpectedReferences: string[] = []
  const externalDatasetKeyReferences: string[] = []

  for (const file of files) {
    const lines = (await readFile(file, "utf8")).split(/\r?\n/u)
    for (const [index, line] of lines.entries()) {
      if (!line.includes(legacyReference)) continue
      if (line.includes(`artifacts/${legacyReference}`)) continue
      if (/datasetS3Key:\s*"benchmarks\/approved-suite\.jsonl"/u.test(line)) {
        externalDatasetKeyReferences.push(`${path.relative(repoRoot, file)}:${index + 1}`)
        continue
      }
      unexpectedReferences.push(`${path.relative(repoRoot, file)}:${index + 1}: ${line.trim()}`)
    }
  }

  assert.deepEqual(unexpectedReferences, [], `legacy repository path references found:\n${unexpectedReferences.join("\n")}`)
  assert.equal(externalDatasetKeyReferences.length, 2, "the two existing external S3 dataset-key fixtures must remain explicit")
})
