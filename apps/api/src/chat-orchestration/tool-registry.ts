import type { ChatToolDefinition, ChatToolInvocation, ChatToolInvocationStatus, DebugStep, JsonValue } from "../types.js"

export const CHAT_TOOL_REGISTRY_VERSION = "chat-tool-registry-v1"

export const RAG_IMPLEMENTED_TOOL_IDS = [
  "rag.decontextualize_query",
  "rag.plan_required_facts",
  "rag.search",
  "rag.rerank",
  "rag.select_final_context",
  "rag.compute_policy_facts",
  "rag.evaluate_answerability",
  "rag.answer",
  "rag.validate_citations",
  "rag.verify_answer_support",
  "rag.repair_supported_only",
  "rag.explain_unavailable"
] as const

const schemaRef = (name: string): JsonValue => ({ schemaRef: name })

const ragTool = (
  toolId: string,
  displayName: string,
  description: string,
  traceLabels: string[],
  requiredFeaturePermission = "rag:run"
): ChatToolDefinition => ({
  toolId,
  name: toolId,
  displayName,
  description,
  category: "rag",
  inputSchema: schemaRef(`${toolId}.input`),
  outputSchema: schemaRef(`${toolId}.output`),
  requiredFeaturePermission,
  requiredResourcePermission: "readOnly",
  approvalRequired: false,
  auditRequired: true,
  enabled: true,
  implementationStatus: "implemented",
  orchestrationModes: ["rag_answer"],
  graphNodeLabels: traceLabels,
  traceLabels
})

const disabledTool = (
  toolId: string,
  category: ChatToolDefinition["category"],
  displayName: string,
  description: string,
  requiredFeaturePermission: string,
  options: {
    requiredResourcePermission?: ChatToolDefinition["requiredResourcePermission"]
    approvalRequired?: boolean
    orchestrationModes?: ChatToolDefinition["orchestrationModes"]
    disabledReason?: string
  } = {}
): ChatToolDefinition => ({
  toolId,
  name: toolId,
  displayName,
  description,
  category,
  inputSchema: schemaRef(`${toolId}.input`),
  outputSchema: schemaRef(`${toolId}.output`),
  requiredFeaturePermission,
  requiredResourcePermission: options.requiredResourcePermission,
  approvalRequired: options.approvalRequired ?? false,
  auditRequired: true,
  enabled: false,
  disabledReason: options.disabledReason ?? "後続 phase の実装・認可・UI 承認設計に依存するため、本 registry では metadata のみに留める。",
  implementationStatus: "placeholder",
  orchestrationModes: options.orchestrationModes ?? [],
  graphNodeLabels: [],
  traceLabels: []
})

const implementedRagTools: ChatToolDefinition[] = [
  ragTool("rag.decontextualize_query", "文脈独立化クエリ生成", "省略を含む multi-turn 質問を standalone question と retrieval query に変換する。", [
    "build_conversation_state",
    "decontextualize_query"
  ], "chat:create"),
  ragTool("rag.plan_required_facts", "必須事実計画", "質問に回答するために必要な RequiredFact を汎用的に計画する。", [
    "plan_search"
  ], "chat:create"),
  ragTool("rag.search", "権限内文書検索", "権限・検索範囲・品質条件を満たす文書を lexical / vector / fusion で検索する。", [
    "normalize_query",
    "retrieve_memory",
    "generate_clues",
    "execute_search_action",
    "retrieval_evaluator"
  ], "chat:create"),
  ragTool("rag.rerank", "検索候補 rerank", "検索候補を score、layout、previous citation anchor、page continuity に基づいて再順位付けする。", [
    "rerank_chunks"
  ]),
  ragTool("rag.select_final_context", "最終回答文脈選択", "minScore、diversity、context budget を保ちながら最終回答 context を確定する。", [
    "rerank_chunks"
  ]),
  ragTool("rag.compute_policy_facts", "ポリシー計算", "日付・金額・閾値条件を根拠つき computedFacts として計算する。", [
    "detect_tool_intent",
    "extract_policy_computations",
    "execute_computation_tools"
  ], "chat:create"),
  ragTool("rag.evaluate_answerability", "回答可否判定", "RequiredFact と evidence coverage から回答可能性を判定する。", [
    "answerability_gate",
    "sufficient_context_gate"
  ], "chat:create"),
  ragTool("rag.answer", "根拠付き回答生成", "authorized and quality-approved evidence と computedFacts だけを用いて回答する。", [
    "generate_answer"
  ], "chat:create"),
  ragTool("rag.validate_citations", "citation 検証", "回答 citation と質問要求 slot の充足を検証する。", [
    "validate_citations"
  ]),
  ragTool("rag.verify_answer_support", "回答支持検証", "生成後回答の各文が evidence / computedFacts に支持されるか検証する。", [
    "verify_answer_support"
  ]),
  ragTool("rag.repair_supported_only", "支持済み事実のみの回答修復", "不支持文を除き、支持された事実だけで回答を修復する。", [
    "verify_answer_support"
  ]),
  ragTool("rag.explain_unavailable", "回答不能説明", "根拠不足・矛盾・権限外などの回答不能理由を安全な利用者向け文面に整形する。", [
    "finalize_refusal"
  ], "chat:create")
]

const disabledTools: ChatToolDefinition[] = [
  disabledTool("rag.search_test", "rag", "検索結果検証", "管理者が検索結果を検証する。", "rag:trace:read:sanitized", { requiredResourcePermission: "readOnly", orchestrationModes: ["debug_assist"] }),
  disabledTool("rag.detect_claim_conflict", "rag", "claim conflict 検出", "typed claim / value mismatch から矛盾候補を判定する。", "rag:run", { requiredResourcePermission: "readOnly", orchestrationModes: ["rag_answer"] }),
  disabledTool("document.get_metadata", "document", "文書 metadata 取得", "文書 metadata を取得する。", "document:read", { requiredResourcePermission: "readOnly", orchestrationModes: ["knowledge_admin_assist"] }),
  disabledTool("document.get_chunks", "document", "chunk preview 取得", "文書 chunk preview を取得する。", "debug:chunk:read", { requiredResourcePermission: "readOnly", orchestrationModes: ["debug_assist"] }),
  disabledTool("document.get_citations", "document", "citation 表示情報取得", "chunkId から citation 表示情報を取得する。", "document:read", { requiredResourcePermission: "readOnly", orchestrationModes: ["rag_answer"] }),
  disabledTool("document.reindex_request", "document", "再インデックス要求", "文書または folder の再インデックスを要求する。", "index:rebuild", { requiredResourcePermission: "full", approvalRequired: true, orchestrationModes: ["knowledge_admin_assist"] }),
  disabledTool("ingest.get_status", "ingest", "取り込み状態取得", "document ingest run の状態、counter、warning を取得する。", "debug:ingest:read", { requiredResourcePermission: "readOnly", orchestrationModes: ["debug_assist"] }),
  disabledTool("ingest.retry_failed", "ingest", "失敗取り込み再実行", "失敗した取り込みを再実行する。", "index:rebuild", { requiredResourcePermission: "full", approvalRequired: true, orchestrationModes: ["knowledge_admin_assist"] }),
  disabledTool("ingest.preview_extraction", "ingest", "抽出結果 preview", "取り込み run の抽出結果 preview を確認する。", "debug:ingest:read", { requiredResourcePermission: "readOnly", orchestrationModes: ["debug_assist"] }),
  disabledTool("drawing.extract_title_block", "drawing", "図面 title block 抽出", "図面番号、図面名、改訂、尺度などを抽出する。", "document:read", { requiredResourcePermission: "readOnly", orchestrationModes: ["rag_answer"] }),
  disabledTool("drawing.list_layers", "drawing", "CAD layer 一覧", "CAD layer 一覧を取得する。", "document:read", { requiredResourcePermission: "readOnly", orchestrationModes: ["rag_answer"] }),
  disabledTool("drawing.list_blocks", "drawing", "block 一覧", "block / symbol 一覧を取得する。", "document:read", { requiredResourcePermission: "readOnly", orchestrationModes: ["rag_answer"] }),
  disabledTool("drawing.render_sheet", "drawing", "図面 sheet render", "図面 sheet を表示用画像へ変換する。", "document:read", { requiredResourcePermission: "readOnly", orchestrationModes: ["rag_answer"] }),
  disabledTool("drawing.find_annotations", "drawing", "図面 annotation 抽出", "注記・寸法文字・表を抽出する。", "document:read", { requiredResourcePermission: "readOnly", orchestrationModes: ["rag_answer"] }),
  disabledTool("drawing.get_bim_entities", "drawing", "BIM entity 取得", "IFC entity / property set を取得する。", "document:read", { requiredResourcePermission: "readOnly", orchestrationModes: ["rag_answer"] }),
  disabledTool("support.ticket.create", "support", "問い合わせ作成", "回答不能や低評価から問い合わせを作成する。", "support:ticket:create:self", { approvalRequired: true, orchestrationModes: ["support_triage"] }),
  disabledTool("support.ticket.update", "support", "問い合わせ更新", "問い合わせの状態、担当者、メモを更新する。", "support:ticket:update", { requiredResourcePermission: "full", orchestrationModes: ["support_triage"] }),
  disabledTool("support.ticket.assign", "support", "問い合わせ担当者割当", "問い合わせを担当者へ割り当てる。", "support:ticket:assign", { requiredResourcePermission: "full", orchestrationModes: ["support_triage"] }),
  disabledTool("support.draft_answer.create", "support", "回答案作成", "担当者向け回答案を作成する。", "support:draft_answer:create", { requiredResourcePermission: "readOnly", orchestrationModes: ["support_triage"] }),
  disabledTool("support.draft_answer.send", "support", "回答案送信", "回答案を利用者へ送信する。", "support:draft_answer:send", { requiredResourcePermission: "full", approvalRequired: true, orchestrationModes: ["support_triage"] }),
  disabledTool("search_improvement.suggest", "search_improvement", "検索改善候補作成", "検索失敗から検索語対応づけ候補を作る。", "search_improvement:suggest", { requiredResourcePermission: "readOnly", orchestrationModes: ["search_improvement_assist"] }),
  disabledTool("search_improvement.test", "search_improvement", "検索改善差分検証", "検索改善反映前後の検索結果差分を確認する。", "search_improvement:review", { orchestrationModes: ["search_improvement_assist"] }),
  disabledTool("search_improvement.publish", "search_improvement", "検索改善公開", "検索改善ルールを公開する。", "search_improvement:publish", { approvalRequired: true, orchestrationModes: ["search_improvement_assist"] }),
  disabledTool("benchmark.run", "benchmark", "benchmark run 開始", "benchmark run を開始する。", "benchmark:run", { requiredResourcePermission: "readOnly", orchestrationModes: ["benchmark_assist"] }),
  disabledTool("benchmark.compare", "benchmark", "benchmark 比較", "前回 run と今回 run を比較する。", "benchmark:read", { orchestrationModes: ["benchmark_assist"] }),
  disabledTool("benchmark.promote_result", "benchmark", "benchmark 結果反映", "benchmark 結果を本番反映する。", "benchmark:promote_result", { approvalRequired: true, orchestrationModes: ["benchmark_assist"] }),
  disabledTool("debug.trace.get", "debug", "trace 取得", "sanitize 済み trace を取得する。", "debug:trace:read:sanitized", { orchestrationModes: ["debug_assist"] }),
  disabledTool("debug.trace.export", "debug", "trace export", "trace を JSON で export する。", "debug:trace:export", { approvalRequired: true, orchestrationModes: ["debug_assist"] }),
  disabledTool("debug.rag_run.inspect", "debug", "RAG run 調査", "RAG run の検索・rerank・回答不能理由を確認する。", "rag:trace:read:sanitized", { orchestrationModes: ["debug_assist"] }),
  disabledTool("debug.ingest_run.inspect", "debug", "取り込み run 調査", "取り込み run の拡張子別処理と chunk 結果を確認する。", "debug:ingest:read", { orchestrationModes: ["debug_assist"] }),
  disabledTool("debug.tool_invocation.inspect", "debug", "tool invocation 調査", "tool 入出力概要とエラーを確認する。", "chat_orchestration:trace:read:sanitized", { orchestrationModes: ["debug_assist"] }),
  disabledTool("external.ticket.create", "external", "外部 ticket 作成", "外部チケットシステムへ問い合わせを連携する。", "tool:credential:use", { approvalRequired: true, orchestrationModes: ["support_triage"] }),
  disabledTool("external.workflow.start", "external", "外部 workflow 開始", "社内ワークフローを開始する。", "tool:credential:use", { approvalRequired: true, orchestrationModes: ["support_triage"] }),
  disabledTool("external.webhook.post", "external", "外部 webhook 送信", "設定済み webhook に通知する。", "tool:credential:use", { approvalRequired: true, orchestrationModes: ["support_triage"] }),
  disabledTool("quality.document.get_profile", "quality", "文書品質 profile 取得", "文書の品質プロファイルを取得する。", "quality:read", { requiredResourcePermission: "readOnly", orchestrationModes: ["knowledge_admin_assist"] }),
  disabledTool("quality.document.update_status", "quality", "文書品質 status 更新", "検証状態、鮮度状態、RAG利用可否を更新する。", "quality:update", { requiredResourcePermission: "full", approvalRequired: true, orchestrationModes: ["knowledge_admin_assist"] }),
  disabledTool("quality.document.request_review", "quality", "文書 review 依頼", "文書オーナーへ検証依頼を作成する。", "quality:review_request:create", { requiredResourcePermission: "readOnly", orchestrationModes: ["knowledge_admin_assist"] }),
  disabledTool("quality.document.exclude_from_rag", "quality", "RAG 除外", "文書をRAG対象から除外する。", "quality:exclude", { requiredResourcePermission: "full", approvalRequired: true, orchestrationModes: ["knowledge_admin_assist"] }),
  disabledTool("quality.conflict.detect", "quality", "品質 conflict 検出", "新旧・矛盾候補を検出する。", "quality:conflict:detect", { requiredResourcePermission: "readOnly", orchestrationModes: ["knowledge_admin_assist"] }),
  disabledTool("parse.document.get_result", "parse", "ParsedDocument 取得", "ParsedDocument を取得する。", "parse:read", { requiredResourcePermission: "readOnly", orchestrationModes: ["knowledge_admin_assist"] }),
  disabledTool("parse.document.reanalyze", "parse", "文書再解析", "文書を再解析する。", "parse:reanalyze", { requiredResourcePermission: "full", approvalRequired: true, orchestrationModes: ["knowledge_admin_assist"] }),
  disabledTool("parse.table.review", "parse", "表抽出 review", "表抽出結果をレビューする。", "parse:table:review", { requiredResourcePermission: "full", approvalRequired: true, orchestrationModes: ["knowledge_admin_assist"] }),
  disabledTool("parse.ocr.rerun", "parse", "OCR 再実行", "OCR を再実行する。", "parse:ocr:rerun", { requiredResourcePermission: "full", approvalRequired: true, orchestrationModes: ["knowledge_admin_assist"] }),
  disabledTool("parse.figure.review", "parse", "図説明 review", "図説明・図OCRをレビューする。", "parse:figure:review", { requiredResourcePermission: "full", approvalRequired: true, orchestrationModes: ["knowledge_admin_assist"] })
]

export const CHAT_TOOL_DEFINITIONS: readonly ChatToolDefinition[] = Object.freeze([
  ...implementedRagTools,
  ...disabledTools
])

export const CHAT_TOOL_DEFINITION_BY_ID = new Map(CHAT_TOOL_DEFINITIONS.map((definition) => [definition.toolId, definition]))

export type ChatToolTraceMapping = {
  toolId: string
  traceLabels: string[]
}

export const RAG_CHAT_TOOL_NODE_MAPPINGS: readonly ChatToolTraceMapping[] = Object.freeze(
  implementedRagTools.map((definition) => ({
    toolId: definition.toolId,
    traceLabels: definition.traceLabels
  }))
)

export function getChatToolDefinition(toolId: string): ChatToolDefinition | undefined {
  return CHAT_TOOL_DEFINITION_BY_ID.get(toolId)
}

export function listEnabledChatToolDefinitions(): ChatToolDefinition[] {
  return CHAT_TOOL_DEFINITIONS.filter((definition) => definition.enabled)
}

export function buildChatToolInvocationsFromTrace(input: {
  orchestrationRunId: string
  requesterUserId: string
  steps: DebugStep[]
}): ChatToolInvocation[] {
  return input.steps.flatMap((step) => {
    const definitions = implementedRagTools.filter((definition) => definition.traceLabels.includes(step.label))
    return definitions.map((definition) => ({
      invocationId: `${input.orchestrationRunId}:${step.id}:${definition.toolId}`,
      orchestrationRunId: input.orchestrationRunId,
      toolId: definition.toolId,
      requesterUserId: input.requesterUserId,
      status: mapDebugStepStatus(step.status),
      input: {
        traceLabel: step.label
      },
      inputSummary: {
        traceLabel: step.label,
        summary: step.summary
      },
      output: sanitizeDebugStepOutput(step.output),
      outputSummary: {
        hitCount: step.hitCount ?? null,
        tokenCount: step.tokenCount ?? null,
        status: step.status
      },
      errorMessage: step.status === "error" ? step.detail ?? step.summary : undefined,
      startedAt: step.startedAt,
      completedAt: step.completedAt
    }))
  })
}

function mapDebugStepStatus(status: DebugStep["status"]): ChatToolInvocationStatus {
  if (status === "error") return "failed"
  return "succeeded"
}

function sanitizeDebugStepOutput(output: DebugStep["output"]): JsonValue | undefined {
  if (!output) return undefined
  return toJsonValue(output)
}

function toJsonValue(value: unknown): JsonValue | undefined {
  if (value === null) return null
  if (["string", "number", "boolean"].includes(typeof value)) return value as JsonValue
  if (Array.isArray(value)) return value.map((item) => toJsonValue(item) ?? null)
  if (typeof value !== "object") return undefined
  const entries = Object.entries(value as Record<string, unknown>)
    .map(([key, item]) => [key, toJsonValue(item)] as const)
    .filter((entry): entry is readonly [string, JsonValue] => entry[1] !== undefined)
  return Object.fromEntries(entries)
}
