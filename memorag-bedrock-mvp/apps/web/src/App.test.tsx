import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"
import App from "./App.js"
import type { HumanQuestion } from "./api.js"

const documents = [
  { documentId: "doc-1", fileName: "requirements.md", chunkCount: 2, memoryCardCount: 1, createdAt: "2026-04-30T00:00:00.000Z" },
  { documentId: "doc-2", fileName: "policy.md", chunkCount: 1, memoryCardCount: 1, createdAt: "2026-04-29T00:00:00.000Z" }
]

const longFinalizeResponse = `ソフトウェア要求は製品要求とプロジェクト要求に分類されます。${"分類根拠。".repeat(220)}END_OF_FINALIZE_RESPONSE`

const debugTrace = {
  runId: "run/with:unsafe*chars",
  question: "ソフトウェア要求の分類を洗い出して",
  modelId: "amazon.nova-lite-v1:0",
  embeddingModelId: "amazon.titan-embed-text-v2:0",
  clueModelId: "amazon.nova-lite-v1:0",
  topK: 6,
  memoryTopK: 4,
  minScore: 0.2,
  startedAt: "2026-04-30T00:00:00.000Z",
  completedAt: "2026-04-30T00:00:01.250Z",
  totalLatencyMs: 1250,
  status: "warning" as const,
  answerPreview: "",
  isAnswerable: false,
  citations: [],
  retrieved: [
    {
      documentId: "doc-1",
      fileName: "requirements.md",
      chunkId: "chunk-0001",
      score: 0.91,
      text: "ソフトウェア要求の分類"
    }
  ],
  steps: [
    {
      id: 1,
      label: "retrieve_memory",
      status: "success" as const,
      latencyMs: 25,
      modelId: "amazon.titan-embed-text-v2:0",
      summary: "memoryを検索しました。",
      hitCount: 2,
      startedAt: "2026-04-30T00:00:00.000Z",
      completedAt: "2026-04-30T00:00:00.025Z"
    },
    {
      id: 2,
      label: "answerability_gate",
      status: "warning" as const,
      latencyMs: 1225,
      summary: "根拠不足です。",
      detail: "low_similarity_score",
      tokenCount: 12,
      startedAt: "2026-04-30T00:00:00.025Z",
      completedAt: "2026-04-30T00:00:01.250Z"
    }
  ]
}

const answerableDebugTrace = {
  ...debugTrace,
  status: "success" as const,
  answerPreview: longFinalizeResponse,
  isAnswerable: true,
  steps: [
    ...debugTrace.steps,
    {
      id: 3,
      label: "finalize_response",
      status: "success" as const,
      latencyMs: 9,
      summary: "finalized",
      detail: longFinalizeResponse,
      tokenCount: 430,
      startedAt: "2026-04-30T00:00:01.250Z",
      completedAt: "2026-04-30T00:00:01.259Z"
    }
  ]
}

const humanQuestion: HumanQuestion = {
  questionId: "question-1",
  title: "山田さんの昼食について確認したい",
  question: "今日山田さんは何を食べたか、担当者に確認してください。",
  requesterName: "山田 太郎",
  requesterDepartment: "利用部門",
  assigneeDepartment: "総務部",
  category: "その他の質問",
  priority: "normal" as const,
  status: "open" as const,
  sourceQuestion: "今日山田さんは何を食べた?",
  chatAnswer: "資料からは回答できません。",
  createdAt: "2026-04-30T00:00:00.000Z",
  updatedAt: "2026-04-30T00:00:00.000Z"
}

const answeredHumanQuestion: HumanQuestion = {
  ...humanQuestion,
  status: "answered" as const,
  answerTitle: "山田さんの昼食についての回答",
  answerBody: "山田さんは本日、社内食堂でカレーを食べました。",
  responderName: "佐藤 花子",
  responderDepartment: "総務部",
  references: "社内食堂メニュー表",
  answeredAt: "2026-04-30T00:03:16.000Z",
  updatedAt: "2026-04-30T00:03:16.000Z"
}

function response(body: unknown, ok = true) {
  return {
    ok,
    json: vi.fn().mockResolvedValue(body),
    text: vi.fn().mockResolvedValue(typeof body === "string" ? body : JSON.stringify(body))
  }
}

function mockAppFetch() {
  const fetchMock = vi.fn((url: RequestInfo | URL, init?: RequestInit) => {
    const requestUrl = String(url)
    if (requestUrl === "/config.json") return Promise.resolve(response({ apiBaseUrl: "http://api.test" }))
    if (requestUrl.endsWith("/documents") && !init) return Promise.resolve(response({ documents }))
    if (requestUrl.endsWith("/debug-runs") && !init) return Promise.resolve(response({ debugRuns: [] }))
    if (requestUrl.endsWith("/documents/doc-1") && init?.method === "DELETE") return Promise.resolve(response({ documentId: "doc-1", deletedVectorCount: 3 }))
    if (requestUrl.endsWith("/documents") && init?.method === "POST") {
      return Promise.resolve(response({ documentId: "doc-3", fileName: "upload.txt", chunkCount: 1, memoryCardCount: 1, createdAt: "now" }))
    }
    if (requestUrl.endsWith("/chat") && init?.method === "POST") {
      const body = JSON.parse(String(init.body ?? "{}")) as { includeDebug?: boolean }
      return Promise.resolve(
        response({
          answer: "ソフトウェア要求は製品要求とプロジェクト要求に分類されます。",
          isAnswerable: true,
          citations: [
            {
              documentId: "doc-1",
              fileName: "requirements.md",
              chunkId: "chunk-0001",
              score: 0.91,
              text: "ソフトウェア要求の分類"
            }
          ],
          retrieved: [],
          debug: body.includeDebug ? answerableDebugTrace : undefined
        })
      )
    }
    return Promise.resolve(response({}))
  })
  vi.stubGlobal("fetch", fetchMock)
  return fetchMock
}

describe("App document management", () => {
  it("shows copy buttons and copies prompt/answer text", async () => {
    mockAppFetch()
    const writeText = vi.fn().mockResolvedValue(undefined)
    vi.stubGlobal("navigator", { clipboard: { writeText } })

    render(<App />)

    await userEvent.type(screen.getByLabelText("質問"), "分類を教えて")
    await userEvent.click(screen.getByTitle("送信"))

    await screen.findByText("ソフトウェア要求は製品要求とプロジェクト要求に分類されます。")

    await userEvent.click(screen.getByRole("button", { name: "プロンプトをコピー" }))
    expect(writeText).toHaveBeenCalledWith("分類を教えて")

    await userEvent.click(screen.getByRole("button", { name: "回答をコピー" }))
    expect(writeText).toHaveBeenCalledWith("ソフトウェア要求は製品要求とプロジェクト要求に分類されます。")

    expect(screen.queryByTitle("高評価")).not.toBeInTheDocument()
    expect(screen.queryByTitle("低評価")).not.toBeInTheDocument()
    expect(screen.queryByTitle("共有")).not.toBeInTheDocument()
  })

  it("disables delete until a concrete document is selected", async () => {
    mockAppFetch()
    render(<App />)

    const deleteButton = await screen.findByTitle("削除する資料を選択")
    expect(deleteButton).toBeDisabled()

    await userEvent.selectOptions(screen.getByLabelText("ドキュメント"), "doc-1")
    expect(screen.getByTitle("requirements.mdを削除")).toBeEnabled()
  })

  it("deletes selected document only after confirmation and refreshes the list", async () => {
    const fetchMock = mockAppFetch()
    const confirmMock = vi.spyOn(window, "confirm").mockReturnValue(true)
    render(<App />)

    await userEvent.selectOptions(await screen.findByLabelText("ドキュメント"), "doc-1")
    await userEvent.click(screen.getByTitle("requirements.mdを削除"))

    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith("http://api.test/documents/doc-1", { method: "DELETE" }))
    expect(confirmMock).toHaveBeenCalledWith("「requirements.md」を削除します。元資料、manifest、検索ベクトルが削除されます。")
    await waitFor(() => expect(screen.getByLabelText("ドキュメント")).toHaveValue("all"))
  })

  it("does not call DELETE when deletion is cancelled", async () => {
    const fetchMock = mockAppFetch()
    vi.spyOn(window, "confirm").mockReturnValue(false)
    render(<App />)

    await userEvent.selectOptions(await screen.findByLabelText("ドキュメント"), "doc-1")
    await userEvent.click(screen.getByTitle("requirements.mdを削除"))

    expect(fetchMock).not.toHaveBeenCalledWith("http://api.test/documents/doc-1", { method: "DELETE" })
  })

  it("shows API errors during deletion", async () => {
    const fetchMock = vi.fn((url: RequestInfo | URL, init?: RequestInit) => {
      const requestUrl = String(url)
      if (requestUrl === "/config.json") return Promise.resolve(response({ apiBaseUrl: "http://api.test" }))
      if (requestUrl.endsWith("/documents") && !init) return Promise.resolve(response({ documents }))
      if (requestUrl.endsWith("/debug-runs") && !init) return Promise.resolve(response({ debugRuns: [] }))
      if (requestUrl.endsWith("/documents/doc-1") && init?.method === "DELETE") return Promise.resolve(response("delete failed", false))
      return Promise.resolve(response({}))
    })
    vi.stubGlobal("fetch", fetchMock)
    vi.spyOn(window, "confirm").mockReturnValue(true)
    render(<App />)

    await userEvent.selectOptions(await screen.findByLabelText("ドキュメント"), "doc-1")
    await userEvent.click(screen.getByTitle("requirements.mdを削除"))

    expect(await screen.findByText("delete failed")).toBeInTheDocument()
  })

  it("resets a selected document when refresh no longer returns it", async () => {
    let documentListCalls = 0
    const fetchMock = vi.fn((url: RequestInfo | URL, init?: RequestInit) => {
      const requestUrl = String(url)
      if (requestUrl === "/config.json") return Promise.resolve(response({ apiBaseUrl: "http://api.test" }))
      if (requestUrl.endsWith("/documents") && !init) {
        documentListCalls += 1
        return Promise.resolve(response({ documents: documentListCalls === 1 ? documents : [documents[1]] }))
      }
      if (requestUrl.endsWith("/debug-runs") && !init) return Promise.resolve(response({ debugRuns: [] }))
      if (requestUrl.endsWith("/documents") && init?.method === "POST") {
        return Promise.resolve(response({ documentId: "doc-3", fileName: "upload.txt", chunkCount: 1, memoryCardCount: 1, createdAt: "now" }))
      }
      return Promise.resolve(response({}))
    })
    vi.stubGlobal("fetch", fetchMock)
    render(<App />)

    await userEvent.selectOptions(await screen.findByLabelText("ドキュメント"), "doc-1")
    const input = document.querySelector<HTMLInputElement>('input[type="file"]')
    await userEvent.upload(input as HTMLInputElement, new File(["資料"], "refresh.txt", { type: "text/plain" }))
    await userEvent.click(screen.getByTitle("送信"))

    await screen.findByText("資料を取り込みました。知りたいことを入力してください。")
    expect(screen.getByLabelText("ドキュメント")).toHaveValue("all")
  })
})

describe("App chat and upload flow", () => {
  it("starts with an empty composer and disabled send action", async () => {
    mockAppFetch()
    render(<App />)

    expect(await screen.findByTitle("送信")).toBeDisabled()
    expect(screen.getByLabelText("質問")).toHaveValue("")
  })

  it("uploads an attached file and answers a question from citations", async () => {
    const fetchMock = mockAppFetch()
    render(<App />)

    const input = document.querySelector<HTMLInputElement>('input[type="file"]')
    expect(input).toBeTruthy()
    await userEvent.upload(input as HTMLInputElement, new File(["要求分類"], "upload.txt", { type: "text/plain" }))
    await userEvent.type(screen.getByLabelText("質問"), "ソフトウェア要求の分類を洗い出して")
    await userEvent.click(screen.getByTitle("送信"))

    await screen.findByText("ソフトウェア要求は製品要求とプロジェクト要求に分類されます。")
    expect(screen.getAllByText("requirements.md").length).toBeGreaterThanOrEqual(2)

    const uploadCall = fetchMock.mock.calls.find(([url, init]) => String(url).endsWith("/documents") && (init as RequestInit | undefined)?.method === "POST")
    const chatCall = fetchMock.mock.calls.find(([url, init]) => String(url).endsWith("/chat") && (init as RequestInit | undefined)?.method === "POST")
    expect(uploadCall).toBeTruthy()
    expect(chatCall).toBeTruthy()
  })

  it("ingests an attached file without asking a question", async () => {
    mockAppFetch()
    render(<App />)

    const input = document.querySelector<HTMLInputElement>('input[type="file"]')
    await userEvent.upload(input as HTMLInputElement, new File(["資料"], "only-upload.txt", { type: "text/plain" }))
    await userEvent.click(screen.getByTitle("送信"))

    expect(await screen.findByText("資料を取り込みました。知りたいことを入力してください。")).toBeInTheDocument()
  })

  it("renders debug trace details, downloads markdown, and resets the conversation", async () => {
    mockAppFetch()
    const createObjectUrl = vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:trace")
    const revokeObjectUrl = vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => undefined)
    const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => undefined)
    render(<App />)

    await userEvent.click(screen.getByRole("checkbox"))
    expect(await screen.findByLabelText("デバッグパネル")).toBeInTheDocument()
    expect(screen.getByText("8 ステップ")).toBeInTheDocument()

    await userEvent.type(screen.getByLabelText("質問"), "ソフトウェア要求の分類を洗い出して")
    await userEvent.click(screen.getByTitle("送信"))

    expect(await screen.findByText("answerability_gate")).toBeInTheDocument()
    expect(screen.getAllByText("1.25 秒").length).toBeGreaterThanOrEqual(2)
    await userEvent.click(screen.getByText("すべて展開"))
    expect(screen.getByText("すべて閉じる")).toBeInTheDocument()
    await userEvent.click(screen.getByText("answerability_gate"))
    expect(await screen.findByText("low_similarity_score")).toBeInTheDocument()

    await userEvent.click(screen.getByTitle("Markdownでダウンロード"))
    expect(createObjectUrl).toHaveBeenCalled()
    const markdown = await (createObjectUrl.mock.calls[0]?.[0] as Blob).text()
    expect(markdown).toContain("### 3. finalize_response")
    expect(markdown).toContain("END_OF_FINALIZE_RESPONSE")
    expect(click).toHaveBeenCalled()
    expect(revokeObjectUrl).toHaveBeenCalledWith("blob:trace")

    await userEvent.click(screen.getByText("新しい会話"))
    expect(screen.queryByText("ソフトウェア要求は製品要求とプロジェクト要求に分類されます。")).not.toBeInTheDocument()
    expect(screen.getByLabelText("質問")).toHaveValue("")
  })

  it("disables submission while a question is pending and selects the returned debug run", async () => {
    let resolveChat: ((value: ReturnType<typeof response>) => void) | undefined
    const fetchMock = vi.fn((url: RequestInfo | URL, init?: RequestInit) => {
      const requestUrl = String(url)
      if (requestUrl === "/config.json") return Promise.resolve(response({ apiBaseUrl: "http://api.test" }))
      if (requestUrl.endsWith("/documents") && !init) return Promise.resolve(response({ documents }))
      if (requestUrl.endsWith("/debug-runs") && !init) return Promise.resolve(response({ debugRuns: [debugTrace] }))
      if (requestUrl.endsWith("/chat") && init?.method === "POST") {
        return new Promise((resolve) => {
          resolveChat = resolve
        })
      }
      return Promise.resolve(response({}))
    })
    vi.stubGlobal("fetch", fetchMock)
    render(<App />)

    await userEvent.click(screen.getByRole("checkbox"))
    await userEvent.selectOptions(await screen.findByLabelText("実行ID"), debugTrace.runId)
    expect(await screen.findByText("answerability_gate")).toBeInTheDocument()

    await userEvent.type(screen.getByLabelText("質問"), "処理中の表示を確認したい")
    await userEvent.click(screen.getByTitle("送信"))

    expect(await screen.findByText("処理中の表示を確認したい")).toBeInTheDocument()
    expect(screen.getByTitle("送信")).toBeDisabled()

    resolveChat?.(
      response({
        answer: "処理中表示を確認しました。",
        isAnswerable: true,
        citations: [],
        retrieved: [],
        debug: { ...debugTrace, runId: "run-processing", question: "処理中の表示を確認したい", status: "success" as const, isAnswerable: true }
      })
    )
    expect(await screen.findByText("処理中表示を確認しました。")).toBeInTheDocument()
    expect(screen.getByLabelText("実行ID")).toHaveValue("run-processing")
  })

  it("selects a persisted debug run from history", async () => {
    const olderTrace = { ...debugTrace, runId: "run-old", status: "success" as const, isAnswerable: true, totalLatencyMs: 250 }
    const fetchMock = vi.fn((url: RequestInfo | URL, init?: RequestInit) => {
      const requestUrl = String(url)
      if (requestUrl === "/config.json") return Promise.resolve(response({ apiBaseUrl: "http://api.test" }))
      if (requestUrl.endsWith("/documents") && !init) return Promise.resolve(response({ documents }))
      if (requestUrl.endsWith("/debug-runs") && !init) return Promise.resolve(response({ debugRuns: [debugTrace, olderTrace] }))
      return Promise.resolve(response({}))
    })
    vi.stubGlobal("fetch", fetchMock)
    render(<App />)

    await screen.findByRole("option", { name: "run-old" })
    await userEvent.selectOptions(await screen.findByLabelText("実行ID"), "run-old")
    expect(screen.getByLabelText("実行ID")).toHaveValue("run-old")
  })

  it("submits with Enter and sends the selected model", async () => {
    const fetchMock = mockAppFetch()
    render(<App />)

    await userEvent.selectOptions(screen.getByLabelText("モデル"), "anthropic.claude-3-haiku-20240307-v1:0")
    await userEvent.type(screen.getByLabelText("質問"), "分類は？{Enter}")

    await screen.findByText("ソフトウェア要求は製品要求とプロジェクト要求に分類されます。")
    const chatCall = fetchMock.mock.calls.find(([url, init]) => String(url).endsWith("/chat") && (init as RequestInit | undefined)?.method === "POST")
    expect(JSON.parse(String((chatCall?.[1] as RequestInit).body))).toMatchObject({
      modelId: "anthropic.claude-3-haiku-20240307-v1:0"
    })
  })


  it("switches to Ctrl+Enter submission mode and keeps Enter as newline", async () => {
    const fetchMock = mockAppFetch()
    render(<App />)

    await userEvent.selectOptions(screen.getByLabelText("送信キー"), "ctrlEnter")
    const textarea = screen.getByLabelText("質問")
    await userEvent.type(textarea, "分類は？{Enter}続き")
    expect(textarea).toHaveValue("分類は？\n続き")

    await userEvent.keyboard("{Control>}{Enter}{/Control}")

    await screen.findByText("ソフトウェア要求は製品要求とプロジェクト要求に分類されます。")
    const chatCall = fetchMock.mock.calls.find(([url, init]) => String(url).endsWith("/chat") && (init as RequestInit | undefined)?.method === "POST")
    expect(chatCall).toBeTruthy()
  })

  it("keeps Shift+Enter as a newline and surfaces chat errors", async () => {
    const fetchMock = vi.fn((url: RequestInfo | URL, init?: RequestInit) => {
      const requestUrl = String(url)
      if (requestUrl === "/config.json") return Promise.resolve(response({ apiBaseUrl: "http://api.test" }))
      if (requestUrl.endsWith("/documents") && !init) return Promise.resolve(response({ documents }))
      if (requestUrl.endsWith("/debug-runs") && !init) return Promise.resolve(response({ debugRuns: [] }))
      if (requestUrl.endsWith("/chat") && init?.method === "POST") return Promise.resolve(response("chat failed", false))
      return Promise.resolve(response({}))
    })
    vi.stubGlobal("fetch", fetchMock)
    render(<App />)

    await userEvent.type(screen.getByLabelText("質問"), "分類は？{Shift>}{Enter}{/Shift}続き")
    expect(screen.getByLabelText("質問")).toHaveValue("分類は？\n続き")
    await userEvent.click(screen.getByTitle("送信"))

    expect(await screen.findByText("chat failed")).toBeInTheDocument()
  })

  it("escalates an unanswerable response, supports assignee answer, and resolves the ticket", async () => {
    let storedQuestions: typeof humanQuestion[] = []
    const fetchMock = vi.fn((url: RequestInfo | URL, init?: RequestInit) => {
      const requestUrl = String(url)
      if (requestUrl === "/config.json") return Promise.resolve(response({ apiBaseUrl: "http://api.test" }))
      if (requestUrl.endsWith("/documents") && !init) return Promise.resolve(response({ documents }))
      if (requestUrl.endsWith("/debug-runs") && !init) return Promise.resolve(response({ debugRuns: [] }))
      if (requestUrl.endsWith("/questions") && !init) return Promise.resolve(response({ questions: storedQuestions }))
      if (requestUrl.endsWith("/chat") && init?.method === "POST") {
        return Promise.resolve(response({ answer: "資料からは回答できません。", isAnswerable: false, citations: [], retrieved: [] }))
      }
      if (requestUrl.endsWith("/questions") && init?.method === "POST") {
        const body = JSON.parse(String(init.body ?? "{}"))
        storedQuestions = [{ ...humanQuestion, ...body }]
        return Promise.resolve(response(storedQuestions[0]))
      }
      if (requestUrl.endsWith("/questions/question-1/answer") && init?.method === "POST") {
        const body = JSON.parse(String(init.body ?? "{}"))
        const current = storedQuestions[0] ?? humanQuestion
        storedQuestions = [{ ...current, ...body, status: "answered", updatedAt: answeredHumanQuestion.updatedAt, answeredAt: answeredHumanQuestion.answeredAt }]
        return Promise.resolve(response(storedQuestions[0]))
      }
      if (requestUrl.endsWith("/questions/question-1/resolve") && init?.method === "POST") {
        const current = storedQuestions[0] ?? answeredHumanQuestion
        storedQuestions = [{ ...current, status: "resolved", resolvedAt: "2026-04-30T00:04:16.000Z" }]
        return Promise.resolve(response(storedQuestions[0]))
      }
      return Promise.resolve(response({}))
    })
    vi.stubGlobal("fetch", fetchMock)
    render(<App />)

    await userEvent.type(screen.getByLabelText("質問"), "今日山田さんは何を食べた?")
    await userEvent.click(screen.getByTitle("送信"))

    expect(await screen.findByText("資料からは回答できません。")).toBeInTheDocument()
    expect(await screen.findByLabelText("担当者へ質問")).toBeInTheDocument()
    await userEvent.selectOptions(screen.getByLabelText("優先度"), "high")
    await userEvent.selectOptions(screen.getByLabelText("カテゴリ"), "手続き")
    await userEvent.selectOptions(screen.getByLabelText("担当部署"), "人事部")
    await userEvent.click(screen.getByText("担当者へ送信"))

    await screen.findByText("担当者へ送信済み")
    await userEvent.click(screen.getByTitle("担当者対応"))
    expect(await screen.findByText("問い合わせ概要")).toBeInTheDocument()
    expect(screen.getByText(/件が対応待ち/)).toBeInTheDocument()
    expect(screen.getByText("下書きは未保存です")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "下書き保存" })).toBeDisabled()
    await userEvent.type(screen.getByLabelText("回答内容"), "山田さんは本日、社内食堂でカレーを食べました。")
    expect(screen.getByText("未保存の変更があります")).toBeInTheDocument()
    await userEvent.click(screen.getByRole("button", { name: "下書き保存" }))
    expect(await screen.findByText(/下書きを保存済み/)).toBeInTheDocument()
    await userEvent.type(screen.getByLabelText("参照資料 / 関連リンク"), "社内食堂メニュー表")
    await userEvent.type(screen.getByLabelText("内部メモ"), "確認済み")
    await userEvent.click(screen.getByLabelText("質問者へ通知する"))
    await userEvent.click(screen.getByText("回答を送信"))

    await userEvent.click(screen.getByTitle("チャットへ戻る"))
    expect(await screen.findByText("担当者からの回答")).toBeInTheDocument()
    expect(screen.getByText("山田さんは本日、社内食堂でカレーを食べました。")).toBeInTheDocument()
    await userEvent.click(screen.getByText("追加で質問する"))
    expect(screen.getByLabelText("質問")).toHaveValue("追加確認: 今日山田さんは何を食べた?について確認したい\n")
    await userEvent.click(screen.getByText("解決した"))
    expect(await screen.findByText("解決済み")).toBeInTheDocument()
  })

  it("renders empty and preloaded assignee workspaces", async () => {
    const resolvedQuestion = {
      ...answeredHumanQuestion,
      questionId: "question-2",
      title: "緊急確認",
      priority: "urgent" as const,
      status: "resolved" as const,
      resolvedAt: "2026-04-30T00:05:16.000Z"
    }
    const questions = [humanQuestion, answeredHumanQuestion, resolvedQuestion]
    const fetchMock = vi.fn((url: RequestInfo | URL, init?: RequestInit) => {
      const requestUrl = String(url)
      if (requestUrl === "/config.json") return Promise.resolve(response({ apiBaseUrl: "http://api.test" }))
      if (requestUrl.endsWith("/documents") && !init) return Promise.resolve(response({ documents: [] }))
      if (requestUrl.endsWith("/debug-runs") && !init) return Promise.resolve(response({ debugRuns: [] }))
      if (requestUrl.endsWith("/questions") && !init) return Promise.resolve(response({ questions }))
      return Promise.resolve(response({}))
    })
    vi.stubGlobal("fetch", fetchMock)
    render(<App />)

    expect(await screen.findByText("資料を添付して開始できます")).toBeInTheDocument()
    await userEvent.click(screen.getByTitle("担当者対応"))
    expect(await screen.findByText("問い合わせ一覧")).toBeInTheDocument()
    expect(screen.getByText("対応中 / 総務部")).toBeInTheDocument()
    await userEvent.click(screen.getByText("緊急確認"))
    expect(screen.getByText("解決済み / 総務部")).toBeInTheDocument()
    expect(screen.getByText("緊急")).toBeInTheDocument()
  })

  it("shows an empty assignee workspace when no questions exist", async () => {
    const fetchMock = vi.fn((url: RequestInfo | URL) => {
      const requestUrl = String(url)
      if (requestUrl === "/config.json") return Promise.resolve(response({ apiBaseUrl: "http://api.test" }))
      if (requestUrl.endsWith("/documents")) return Promise.resolve(response({ documents: [] }))
      if (requestUrl.endsWith("/debug-runs")) return Promise.resolve(response({ debugRuns: [] }))
      if (requestUrl.endsWith("/questions")) return Promise.resolve(response({ questions: [] }))
      return Promise.resolve(response({}))
    })
    vi.stubGlobal("fetch", fetchMock)
    render(<App />)

    await userEvent.click(await screen.findByTitle("担当者対応"))
    expect(await screen.findByText("担当者へ送信された質問はまだありません。")).toBeInTheDocument()
  })

})
