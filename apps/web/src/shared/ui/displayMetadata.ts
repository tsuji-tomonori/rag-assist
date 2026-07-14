import type { AgentProviderAvailability, AsyncAgentRun } from "../../features/agents/types.js"
import type { AliasAuditLogItem, AliasDefinition, ManagedUser } from "../../features/admin/types.js"
import type { BenchmarkMode, BenchmarkRun, BenchmarkRunner } from "../../features/benchmark/types.js"
import type { DebugStep, DebugTrace } from "../../features/debug/types.js"
import type { DebugRunSummary, FactCoverageRow } from "../../features/debug/utils/debugTraceReplay.js"
import type { DocumentManifest, ReindexMigration } from "../../features/documents/types.js"
import type { HumanQuestion } from "../../features/questions/types.js"

export type SemanticTone = "neutral" | "info" | "success" | "warning" | "danger"

export type SemanticPresentation = Readonly<{
  label: string
  tone: SemanticTone
  description?: string
}>

const managedUserStatus = {
  active: { label: "有効", tone: "success" },
  suspended: { label: "停止中", tone: "warning" },
  deleted: { label: "削除済み", tone: "danger" }
} satisfies Record<ManagedUser["status"], SemanticPresentation>

const questionStatus = {
  open: { label: "対応中", tone: "info" },
  in_progress: { label: "担当者対応中", tone: "info" },
  waiting_requester: { label: "依頼者回答待ち", tone: "warning" },
  answered: { label: "回答済み", tone: "success" },
  resolved: { label: "解決済み", tone: "neutral" }
} satisfies Record<HumanQuestion["status"], SemanticPresentation>

const questionPriority = {
  urgent: { label: "緊急", tone: "danger" },
  high: { label: "高", tone: "warning" },
  normal: { label: "通常", tone: "neutral" }
} satisfies Record<HumanQuestion["priority"], SemanticPresentation>

const benchmarkRunStatus = {
  queued: { label: "待機中", tone: "neutral" },
  running: { label: "実行中", tone: "info" },
  succeeded: { label: "成功", tone: "success" },
  failed: { label: "失敗", tone: "danger" },
  cancelled: { label: "取消済み", tone: "neutral" }
} satisfies Record<BenchmarkRun["status"], SemanticPresentation>

const benchmarkModes = {
  agent: "エージェント評価",
  search: "検索評価",
  load: "負荷評価"
} satisfies Record<BenchmarkMode, string>

const benchmarkRunners = {
  codebuild: "CodeBuild",
  lambda: "Lambda"
} satisfies Record<BenchmarkRunner, string>

const agentAvailability = {
  disabled: { label: "無効", tone: "neutral" },
  not_configured: { label: "未設定", tone: "warning" },
  provider_unavailable: { label: "利用不可", tone: "danger" },
  available: { label: "利用可能", tone: "success" }
} satisfies Record<AgentProviderAvailability, SemanticPresentation>

const agentRunStatus = {
  queued: { label: "待機中", tone: "neutral" },
  preparing_workspace: { label: "準備中", tone: "info" },
  running: { label: "実行中", tone: "info" },
  waiting_for_approval: { label: "承認待ち", tone: "warning" },
  completed: { label: "完了", tone: "success" },
  failed: { label: "失敗", tone: "danger" },
  blocked: { label: "ブロック", tone: "danger" },
  cancelled: { label: "キャンセル済み", tone: "neutral" },
  expired: { label: "期限切れ", tone: "warning" }
} satisfies Record<AsyncAgentRun["status"], SemanticPresentation>

const agentFailureReasons = {
  not_configured: "実行環境が未設定",
  provider_unavailable: "実行環境を利用不可",
  cancelled: "キャンセル済み",
  execution_error: "実行エラー"
} satisfies Record<NonNullable<AsyncAgentRun["failureReasonCode"]>, string>

const documentLifecycleStatus = {
  active: { label: "利用中", tone: "success" },
  staging: { label: "切替準備中", tone: "info" },
  superseded: { label: "旧版", tone: "neutral" }
} satisfies Record<NonNullable<DocumentManifest["lifecycleStatus"]>, SemanticPresentation>

const reindexMigrationStatus = {
  staged: { label: "切替待ち", tone: "info" },
  cutover: { label: "切替済み", tone: "success" },
  rolled_back: { label: "切戻し済み", tone: "warning" }
} satisfies Record<ReindexMigration["status"], SemanticPresentation>

type DisplayPermissionLevel = NonNullable<DocumentManifest["currentUserEffectivePermission"]> | "deny"

const permissionLevels = {
  none: "権限なし",
  deny: "権限なし",
  readOnly: "閲覧のみ",
  full: "管理可能"
} satisfies Record<DisplayPermissionLevel, string>

const principalTypes = {
  user: "ユーザー",
  group: "グループ"
} as const

const aliasStatus = {
  draft: { label: "下書き", tone: "neutral" },
  approved: { label: "承認済み", tone: "success" },
  disabled: { label: "無効", tone: "warning" }
} satisfies Record<AliasDefinition["status"], SemanticPresentation>

const aliasAuditActions = {
  create: "作成",
  update: "更新",
  review: "レビュー",
  disable: "無効化",
  publish: "公開"
} satisfies Record<AliasAuditLogItem["action"], string>

const debugStepStatus = {
  success: { label: "成功", tone: "success" },
  warning: { label: "注意", tone: "warning" },
  error: { label: "失敗", tone: "danger" }
} satisfies Record<DebugStep["status"], SemanticPresentation>

const debugRunStatus = {
  answered: { label: "回答", tone: "success" },
  refused: { label: "回答保留", tone: "warning" },
  warning: { label: "注意", tone: "warning" },
  error: { label: "失敗", tone: "danger" }
} satisfies Record<DebugRunSummary["status"], SemanticPresentation>

const debugTargets = {
  rag_run: "RAG 実行",
  ingest_run: "文書取り込み",
  chat_orchestration_run: "チャット処理",
  async_agent_run: "非同期エージェント実行",
  tool_invocation: "ツール実行"
} satisfies Record<NonNullable<DebugTrace["targetType"]>, string>

const debugVisibilities = {
  user_safe: "ユーザー表示可能",
  support_sanitized: "サポート向けマスキング済み",
  operator_sanitized: "運用者向けマスキング済み",
  internal_restricted: "内部限定"
} satisfies Record<NonNullable<DebugTrace["visibility"]>, string>

const debugFailureStages = {
  retrieval: "検索",
  context: "根拠構成",
  answer_generation: "回答生成",
  support_verification: "根拠検証"
} satisfies Record<NonNullable<DebugRunSummary["mainFailureStage"]>, string>

const factCoverageStatus = {
  supported: { label: "根拠あり", tone: "success" },
  missing: { label: "根拠不足", tone: "warning" },
  conflicting: { label: "根拠競合", tone: "danger" },
  unknown: { label: "未確認", tone: "neutral" }
} satisfies Record<FactCoverageRow["status"], SemanticPresentation>

export const managedUserStatusPresentation = (status: ManagedUser["status"]) => managedUserStatus[status]
export const questionStatusPresentation = (status: HumanQuestion["status"]) => questionStatus[status]
export const questionPriorityPresentation = (priority: HumanQuestion["priority"]) => questionPriority[priority]
export const benchmarkRunStatusPresentation = (status: BenchmarkRun["status"]) => benchmarkRunStatus[status]
export const benchmarkModeLabel = (mode?: BenchmarkMode) => mode ? benchmarkModes[mode] : "利用不可"
export const benchmarkRunnerLabel = (runner?: BenchmarkRunner) => runner ? benchmarkRunners[runner] : "利用不可"
export const agentAvailabilityPresentation = (availability: AgentProviderAvailability) => agentAvailability[availability]
export const agentRunStatusPresentation = (status: AsyncAgentRun["status"]) => agentRunStatus[status]
export const agentFailureReasonLabel = (reason: NonNullable<AsyncAgentRun["failureReasonCode"]>) => agentFailureReasons[reason]
export const documentLifecycleStatusPresentation = (status: NonNullable<DocumentManifest["lifecycleStatus"]>) => documentLifecycleStatus[status]
export const reindexMigrationStatusPresentation = (status: ReindexMigration["status"]) => reindexMigrationStatus[status]
export const documentPermissionLabel = (permission: DisplayPermissionLevel) => permissionLevels[permission]
export const principalTypeLabel = (principalType: keyof typeof principalTypes) => principalTypes[principalType]
export const aliasStatusPresentation = (status: AliasDefinition["status"]) => aliasStatus[status]
export const aliasAuditActionLabel = (action: AliasAuditLogItem["action"]) => aliasAuditActions[action]
export const debugStepStatusPresentation = (status: DebugStep["status"]) => debugStepStatus[status]
export const debugRunStatusPresentation = (status: DebugRunSummary["status"]) => debugRunStatus[status]
export const debugTargetLabel = (target?: DebugTrace["targetType"]) => target ? debugTargets[target] : "未設定"
export const debugVisibilityLabel = (visibility?: DebugTrace["visibility"]) => visibility ? debugVisibilities[visibility] : "未設定"
export const debugFailureStageLabel = (stage: DebugRunSummary["mainFailureStage"]) => stage ? debugFailureStages[stage] : "なし"
export const factCoverageStatusPresentation = (status: FactCoverageRow["status"]) => factCoverageStatus[status]
