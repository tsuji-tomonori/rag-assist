import assert from "node:assert/strict"
import { existsSync, readFileSync } from "node:fs"
import path from "node:path"
import test from "node:test"

type ContractPackageManifest = {
  exports: Record<string, { types?: string }>
  typesVersions: Record<string, Record<string, string[]>>
}

const packageRoot = path.resolve(import.meta.dirname, "../..")
const manifest = JSON.parse(
  readFileSync(path.join(packageRoot, "package.json"), "utf8")
) as ContractPackageManifest

const canonicalSubpaths = {
  "access-control": "./src/access-control.ts",
  "rag-quality-control": "./src/rag-quality-control.ts",
  infra: "./src/infra.ts"
} as const

test("contract subpath types resolve to canonical TypeScript sources", () => {
  for (const [subpath, source] of Object.entries(canonicalSubpaths)) {
    assert.equal(manifest.exports[`./${subpath}`]?.types, source)
    assert.deepEqual(manifest.typesVersions["*"]?.[subpath], [source])
  }
})

test("root-level handwritten declaration shims are not reintroduced", () => {
  for (const subpath of Object.keys(canonicalSubpaths)) {
    assert.equal(
      existsSync(path.join(packageRoot, `${subpath}.d.ts`)),
      false,
      `${subpath}.d.ts must not duplicate the canonical TypeScript source`
    )
  }
})

test("canonical package root keeps NodeNext .js re-exports", () => {
  const source = readFileSync(path.join(packageRoot, "src/index.ts"), "utf8")

  for (const subpath of Object.keys(canonicalSubpaths)) {
    assert.match(source, new RegExp(`from ["']\\./${subpath}\\.js["']`))
  }
})
