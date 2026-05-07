import assert from "node:assert/strict"
import { readdir, readFile } from "node:fs/promises"
import path from "node:path"
import test from "node:test"

const coverageByRequirement: Record<string, string[]> = {
  "FR-001": ["text-processing.test.ts", "memorag-service.test.ts", "App.test.tsx"],
  "FR-002": ["memorag-service.test.ts", "text-processing.test.ts"],
  "FR-003": ["graph.test.ts", "memorag-service.test.ts"],
  "FR-004": ["graph.test.ts", "prompts.test.ts"],
  "FR-005": ["graph.test.ts", "prompts.test.ts"],
  "FR-006": ["graph.test.ts", "api.test.ts", "App.test.tsx"],
  "FR-007": ["memorag-service.test.ts", "App.test.tsx"],
  "FR-008": ["memorag-service.test.ts", "local-stores.test.ts"],
  "FR-009": ["App.test.tsx"],
  "FR-010": ["App.test.tsx"],
  "FR-011": ["memorag-service.test.ts", "App.test.tsx"],
  "FR-012": ["benchmark package script", "benchmark/dataset.sample.jsonl"],
  "FR-013": ["api-contract.test.ts", "api.test.ts"],
  "FR-014": ["node-units.test.ts", "graph.test.ts"],
  "FR-015": ["node-units.test.ts", "graph.test.ts"],
  "FR-016": ["node-units.test.ts", "graph.test.ts"],
  "FR-017": ["graph.test.ts", "node-units.test.ts"],
  "FR-018": ["hybrid-search.test.ts", "node-units.test.ts"],
  "FR-019": ["benchmark/run.ts tests via benchmark dataset", "node-units.test.ts"],
  "FR-020": ["memorag-service.test.ts", "local-stores.test.ts"],
  "FR-021": ["questions-access.test.ts", "App.test.tsx"],
  "FR-022": ["useConversationHistory.test.ts", "conversationHistorySearch.test.ts"],
  "FR-023": ["hybrid-search.test.ts", "useAdminData.test.ts"],
  "FR-024": ["authorization.test.ts", "access-control-policy.test.ts"],
  "FR-025": ["LoginPage.test.tsx", "authClient.test.ts"],
  "FR-026": ["hybrid-search.test.ts", "profiles.test.ts"],
  "FR-027": ["authorization.test.ts", "useAdminData.test.ts"],
  "FR-028": ["useConversationHistory.test.ts", "conversationHistorySearch.test.ts"],
  "FR-029": ["graph.test.ts", "useChatSession.test.ts"],
  "FR-030": ["conversationHistorySearch.test.ts"],
  "FR-031": ["App.test.tsx", "AssigneeWorkspace.tsx"],
  "FR-032": ["App.test.tsx", "AssigneeWorkspace.tsx"],
  "FR-033": ["questions-access.test.ts", "App.test.tsx"],
  "FR-034": ["questions-access.test.ts", "useChatSession.test.ts"],
  "FR-035": ["App.test.tsx", "useConversationHistory.test.ts"],
  "FR-036": ["questions-access.test.ts"],
  "FR-037": ["tasks/todo/20260507-2000-hitl-review-feedback-loop.md"],
  "NFR-001": ["graph.test.ts", "local-stores.test.ts", "text-processing.test.ts"],
  "NFR-002": ["infra/test/memorag-mvp-stack.test.ts", "docs/OPERATIONS.md"],
  "NFR-003": ["infra/test/memorag-mvp-stack.test.ts"],
  "NFR-004": ["memorag-service.test.ts", "local-stores.test.ts"],
  "NFR-005": ["memorag-service.test.ts", "graph.test.ts"],
  "NFR-006": ["infra/test/memorag-mvp-stack.test.ts"],
  "NFR-007": ["package scripts", "verification command"],
  "NFR-008": ["package scripts", "verification command"],
  "NFR-009": ["docs/REQUIREMENTS.md", "docs/OPERATIONS.md"],
  "NFR-010": ["authorization.test.ts", "access-control-policy.test.ts"],
  "NFR-011": ["authorization.test.ts", "questions-access.test.ts"],
  "NFR-012": ["hybrid-search.test.ts", "access-control-policy.test.ts"]
}

test("covered requirements map to existing product requirement documents", async () => {
  const docsRoot = path.resolve(process.cwd(), "../../docs/1_要求_REQ/11_製品要求_PRODUCT")
  const requirements = await Promise.all((await listRequirementFiles(docsRoot)).map(readRequirement))
  const requirementIds = requirements.map((requirement) => requirement.id).sort()
  const coveredRequirementIds = Object.keys(coverageByRequirement).sort()

  assert.deepEqual(
    coveredRequirementIds.filter((id) => !requirementIds.includes(id)),
    []
  )
  assert.deepEqual(
    requirementIds.filter((id) => !coveredRequirementIds.includes(id)),
    []
  )
  assert.ok(Object.values(coverageByRequirement).every((links) => links.length > 0))
  assert.ok(requirements.every((requirement) => requirement.text.length > 0))
})

async function listRequirementFiles(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true })
  const nested = await Promise.all(
    entries.map(async (entry) => {
      const entryPath = path.join(dir, entry.name)
      if (entry.isDirectory()) return listRequirementFiles(entryPath)
      if (entry.isFile() && /^REQ_(FUNCTIONAL|NON_FUNCTIONAL)_\d+\.md$/.test(entry.name)) return [entryPath]
      return []
    })
  )
  return nested.flat().sort()
}

async function readRequirement(filePath: string): Promise<{ id: string; text: string }> {
  const markdown = await readFile(filePath, "utf-8")
  const match = markdown.match(/^- ((?:FR|NFR)-\d+): (.+)$/m)
  assert.ok(match, `${filePath} must contain a requirement bullet`)
  return { id: match[1]!, text: match[2]! }
}
