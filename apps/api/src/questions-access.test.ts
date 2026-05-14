import assert from "node:assert/strict"
import { mkdtemp } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"
import { spawn, type ChildProcess } from "node:child_process"
import test from "node:test"

type LocalServer = {
  port: number
  process: ChildProcess
}

test("question requester can read answers and resolve only their own ticket", async () => {
  const dataDir = await mkdtemp(path.join(tmpdir(), "memorag-question-access-"))
  const basePort = 18100 + Math.floor(Math.random() * 3000)
  const requester = await startLocalServer(dataDir, "CHAT_USER", "requester-1", basePort)
  const otherRequester = await startLocalServer(dataDir, "CHAT_USER", "requester-2", basePort + 1)
  const admin = await startLocalServer(dataDir, "SYSTEM_ADMIN", "admin-1", basePort + 2)
  const searchManager = await startLocalServer(dataDir, "RAG_GROUP_MANAGER", "manager-1", basePort + 3)

  try {
    const created = await postJson<{ questionId: string; requesterUserId?: string }>(requester, "/questions", {
      title: "資料外の確認",
      question: "担当者へ確認してください。",
      requesterName: "利用者",
      requesterDepartment: "利用部門",
      assigneeDepartment: "総務部",
      source: "answer_unavailable",
      messageId: "msg-1",
      ragRunId: "run-1",
      answerUnavailableEventId: "event-1",
      answerUnavailableReason: "根拠が不足しています。",
      sanitizedDiagnostics: {
        tier: "support_sanitized",
        answerUnavailableReason: "根拠が不足しています。",
        retrievalQuality: "insufficient_evidence",
        qualityCauses: ["retrieval_gap"],
        visibleCitationIds: ["cite-1"],
        visibleDocumentIds: ["doc-1"],
        visibleChunkIds: ["chunk-1"],
        qualityWarnings: ["検索語対応づけの確認が必要"],
        suggestedNextActions: ["search_improvement_review"]
      }
    })
    assert.equal(created.requesterUserId, "requester-1")

    const requesterList = await fetch(url(requester, "/questions"))
    assert.equal(requesterList.status, 403)

    const openResolve = await fetch(url(requester, `/questions/${created.questionId}/resolve`), { method: "POST" })
    assert.equal(openResolve.status, 409)

    await postJson(admin, `/questions/${created.questionId}/answer`, {
      answerTitle: "回答",
      answerBody: "担当者の確認結果です。",
      references: "社内確認",
      internalMemo: "担当者向けメモ"
    })

    const visibleToRequester = await getJson<Record<string, unknown>>(requester, `/questions/${created.questionId}`)
    assert.equal(visibleToRequester.status, "answered")
    assert.equal(visibleToRequester.answerBody, "担当者の確認結果です。")
    assert.equal(Object.hasOwn(visibleToRequester, "internalMemo"), false)
    assert.equal(Object.hasOwn(visibleToRequester, "sanitizedDiagnostics"), false)

    const visibleToSupport = await getJson<Record<string, unknown>>(admin, `/questions/${created.questionId}`)
    assert.deepEqual(visibleToSupport.sanitizedDiagnostics, {
      tier: "support_sanitized",
      answerUnavailableReason: "根拠が不足しています。",
      retrievalQuality: "insufficient_evidence",
      qualityCauses: ["retrieval_gap"],
      visibleCitationIds: ["cite-1"],
      visibleDocumentIds: ["doc-1"],
      visibleChunkIds: ["chunk-1"],
      qualityWarnings: ["検索語対応づけの確認が必要"],
      suggestedNextActions: ["search_improvement_review"]
    })
    assert.equal(JSON.stringify(visibleToSupport).includes("allowedUsers"), false)
    assert.equal(JSON.stringify(visibleToSupport).includes("internal policy"), false)

    const requesterCandidate = await fetch(url(requester, `/questions/${created.questionId}/search-improvement-candidates`), {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ term: "休暇申請", expansions: ["年次有給休暇"] })
    })
    assert.equal(requesterCandidate.status, 403)

    const candidateResponse = await postJson<Record<string, unknown>>(searchManager, `/questions/${created.questionId}/search-improvement-candidates`, {
      term: "休暇申請",
      expansions: ["年次有給休暇"],
      candidateSource: "ai_suggested",
      suggestionReason: "回答不能 ticket から検索語対応づけの候補を作成",
      reviewReason: "担当者レビュー待ち",
      impactSummary: "休暇関連の検索だけに影響",
      searchResultDiffSummary: "公開前レビューで検索結果差分を確認予定",
      beforeResultIds: ["before-1"],
      afterResultIds: ["after-1"]
    })
    const candidate = candidateResponse.candidate as Record<string, unknown>
    assert.equal(candidate.status, "draft")
    assert.deepEqual(candidate.searchImprovement, {
      candidateSource: "ai_suggested",
      sourceQuestionId: created.questionId,
      sourceMessageId: "msg-1",
      sourceRagRunId: "run-1",
      suggestionReason: "回答不能 ticket から検索語対応づけの候補を作成",
      reviewState: "pending_review",
      reviewReason: "担当者レビュー待ち",
      impactSummary: "休暇関連の検索だけに影響",
      searchResultDiffSummary: "公開前レビューで検索結果差分を確認予定",
      beforeResultIds: ["before-1"],
      afterResultIds: ["after-1"]
    })

    const forbiddenToOther = await fetch(url(otherRequester, `/questions/${created.questionId}`))
    assert.equal(forbiddenToOther.status, 404)

    const forbiddenResolveToOther = await fetch(url(otherRequester, `/questions/${created.questionId}/resolve`), { method: "POST" })
    assert.equal(forbiddenResolveToOther.status, 404)

    const resolvedByRequester = await postJson<Record<string, unknown>>(requester, `/questions/${created.questionId}/resolve`, {})
    assert.equal(resolvedByRequester.status, "resolved")
    assert.equal(Object.hasOwn(resolvedByRequester, "internalMemo"), false)
  } finally {
    requester.process.kill("SIGTERM")
    otherRequester.process.kill("SIGTERM")
    admin.process.kill("SIGTERM")
    searchManager.process.kill("SIGTERM")
  }
})

async function startLocalServer(dataDir: string, groups: string, userId: string, port: number): Promise<LocalServer> {
  const tsxBin = path.resolve(process.cwd(), "../../node_modules/.bin/tsx")
  const child = spawn(tsxBin, ["src/local.ts"], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      PORT: String(port),
      MOCK_BEDROCK: "true",
      USE_LOCAL_VECTOR_STORE: "true",
      USE_LOCAL_QUESTION_STORE: "true",
      LOCAL_DATA_DIR: dataDir,
      AUTH_ENABLED: "false",
      LOCAL_AUTH_GROUPS: groups,
      LOCAL_AUTH_USER_ID: userId
    },
    stdio: ["ignore", "pipe", "pipe"]
  })
  await waitUntilReady(port, child)
  return { port, process: child }
}

async function waitUntilReady(port: number, child: ChildProcess) {
  const started = Date.now()
  while (Date.now() - started < 5000) {
    if (child.exitCode !== null) throw new Error(`server exited with ${child.exitCode}`)
    try {
      const res = await fetch(`http://127.0.0.1:${port}/health`)
      if (res.ok) return
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 100))
    }
  }
  throw new Error(`server on ${port} did not become ready`)
}

function url(server: LocalServer, route: string) {
  return `http://127.0.0.1:${server.port}${route}`
}

async function getJson<T>(server: LocalServer, route: string): Promise<T> {
  const res = await fetch(url(server, route))
  assert.equal(res.status, 200)
  return (await res.json()) as T
}

async function postJson<T = Record<string, unknown>>(server: LocalServer, route: string, body: unknown): Promise<T> {
  const res = await fetch(url(server, route), {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body)
  })
  assert.equal(res.status, 200)
  return (await res.json()) as T
}
