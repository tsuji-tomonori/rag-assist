#!/usr/bin/env node
import { mkdir, readFile, writeFile } from "node:fs/promises"
import path from "node:path"

const args = new Set(process.argv.slice(2))
const inputPath = process.env.DOCUMENT_GROUPS_BACKFILL_INPUT
  ?? path.join(process.env.LOCAL_DATA_DIR ?? ".local-data", "document-groups.json")
const outputPath = process.env.DOCUMENT_GROUPS_BACKFILL_REPORT
  ?? path.join(process.env.LOCAL_DATA_DIR ?? ".local-data", "document-group-canonical-path-backfill-report.json")

if (!args.has("--dry-run")) {
  console.error("Refusing to run without --dry-run. This script only prepares a backfill and duplicate report.")
  process.exit(2)
}

let raw
try {
  raw = JSON.parse(await readFile(inputPath, "utf-8"))
} catch (error) {
  if (error?.code !== "ENOENT") throw error
  await writeReport({
    mode: "dry-run",
    inputPath,
    generatedAt: new Date().toISOString(),
    groupCount: 0,
    duplicateCount: 0,
    canApply: true,
    duplicates: [],
    canonicalFieldUpdates: [],
    lockItems: [],
    skipped: [`Input file not found: ${inputPath}`]
  })
  process.exit(0)
}
const groups = Array.isArray(raw.groups) ? raw.groups : []
const normalizedGroups = normalizeGroups(groups)
const duplicates = duplicateGroups(normalizedGroups)
const missingLockItems = normalizedGroups.map((group) => ({
  groupId: `pathlock#${encodeURIComponent(group.adminPathPk)}#${encodeURIComponent(group.normalizedCanonicalPath)}`,
  itemType: "documentGroupPathLock",
  adminPathPk: group.adminPathPk,
  normalizedCanonicalPath: group.normalizedCanonicalPath,
  lockedGroupId: group.groupId,
  createdAt: group.createdAt,
  updatedAt: group.updatedAt
}))

const report = {
  mode: "dry-run",
  inputPath,
  generatedAt: new Date().toISOString(),
  groupCount: groups.length,
  duplicateCount: duplicates.length,
  canApply: duplicates.length === 0,
  duplicates,
  canonicalFieldUpdates: normalizedGroups.map((group) => ({
    groupId: group.groupId,
    tenantId: group.tenantId,
    adminPrincipalType: group.adminPrincipalType,
    adminPrincipalId: group.adminPrincipalId,
    normalizedName: group.normalizedName,
    canonicalPath: group.canonicalPath,
    normalizedCanonicalPath: group.normalizedCanonicalPath,
    adminPathPk: group.adminPathPk,
    parentPathPk: group.parentPathPk,
    schemaVersion: 2
  })),
  lockItems: missingLockItems,
  skipped: duplicates.length > 0 ? ["Duplicate canonical paths must be resolved before applying lock items."] : []
}

await writeReport(report)
if (duplicates.length > 0) {
  console.error(`duplicate canonical paths found: ${duplicates.length}`)
  process.exit(1)
}

async function writeReport(report) {
  await mkdir(path.dirname(outputPath), { recursive: true })
  await writeFile(outputPath, `${JSON.stringify(report, null, 2)}\n`)
  console.log(`document group canonical path dry-run report: ${outputPath}`)
}

function normalizeGroups(inputGroups) {
  const byId = new Map(inputGroups.map((group) => [group.groupId, group]))
  const normalized = new Map()
  const visit = (group) => {
    const cached = normalized.get(group.groupId)
    if (cached) return cached
    const parent = group.parentGroupId ? byId.get(group.parentGroupId) : undefined
    const normalizedParent = parent ? visit(parent) : undefined
    const name = String(group.name ?? group.groupId).trim() || group.groupId
    const tenantId = group.tenantId ?? normalizedParent?.tenantId ?? "default"
    const adminPrincipalType = group.adminPrincipalType ?? normalizedParent?.adminPrincipalType ?? "user"
    const adminPrincipalId = group.adminPrincipalId ?? normalizedParent?.adminPrincipalId ?? group.ownerUserId
    const normalizedName = normalizeName(name)
    const adminPathPk = `${tenantId}#${adminPrincipalType}#${adminPrincipalId}`
    const canonicalPath = normalizedParent ? `${normalizedParent.canonicalPath}/${name}` : `/${name}`
    const normalizedCanonicalPath = normalizedParent ? `${normalizedParent.normalizedCanonicalPath}/${normalizedName}` : `/${normalizedName}`
    const next = {
      ...group,
      tenantId,
      adminPrincipalType,
      adminPrincipalId,
      name,
      normalizedName,
      canonicalPath,
      normalizedCanonicalPath,
      adminPathPk,
      parentPathPk: `${adminPathPk}#${group.parentGroupId ?? "ROOT"}`,
      schemaVersion: 2,
      itemType: "documentGroup"
    }
    normalized.set(group.groupId, next)
    return next
  }
  return inputGroups.map(visit)
}

function duplicateGroups(inputGroups) {
  const seen = new Map()
  const duplicates = []
  for (const group of inputGroups) {
    const key = `${group.adminPathPk}#${group.normalizedCanonicalPath}`
    const existing = seen.get(key)
    if (existing) duplicates.push({ key, groupIds: [existing.groupId, group.groupId] })
    else seen.set(key, group)
  }
  return duplicates
}

function normalizeName(name) {
  return name.trim().normalize("NFKC").toLocaleLowerCase("ja-JP")
}
