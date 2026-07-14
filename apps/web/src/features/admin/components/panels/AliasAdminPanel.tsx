import { type FormEvent, useState } from "react"
import { ConfirmDialog } from "../../../../shared/components/ConfirmDialog.js"
import {
  EmptyState,
  OperationFeedback,
  StatusBadge,
  confirmedOperation,
  failedOperation,
  feedbackFromOutcome,
  processingOperationFeedback,
  upsertOperationFeedback,
  type OperationFeedbackEntry,
  type OperationOutcome
} from "../../../../shared/ui/index.js"
import { LoadingSpinner } from "../../../../shared/components/LoadingSpinner.js"
import { formatDateTime } from "../../../../shared/utils/format.js"
import { aliasAuditActionLabel, aliasStatusPresentation } from "../../../../shared/ui/displayMetadata.js"
import type { AliasAuditLogItem, AliasDefinition } from "../../types.js"

export function AliasAdminPanel({
  aliases,
  auditLog,
  loadFailed = false,
  loading,
  canWrite,
  canReview,
  canDisable,
  canPublish,
  onCreate,
  onUpdate,
  onReview,
  onDisable,
  onPublish
}: {
  aliases: AliasDefinition[] | null
  auditLog: AliasAuditLogItem[] | null
  loadFailed?: boolean
  loading: boolean
  canWrite: boolean
  canReview: boolean
  canDisable: boolean
  canPublish: boolean
  onCreate: (input: { term: string; expansions: string[]; scope?: AliasDefinition["scope"] }) => Promise<void>
  onUpdate: (aliasId: string, input: { term?: string; expansions?: string[]; scope?: AliasDefinition["scope"] }) => Promise<void>
  onReview: (aliasId: string, decision: "approve" | "reject", comment?: string) => Promise<void>
  onDisable: (aliasId: string) => Promise<OperationOutcome<AliasDefinition> | void>
  onPublish: () => Promise<OperationOutcome<{ version: string; publishedAt: string; aliasCount: number }> | void>
}) {
  const [term, setTerm] = useState("")
  const [expansions, setExpansions] = useState("")
  const [department, setDepartment] = useState("")
  const [disableCandidate, setDisableCandidate] = useState<AliasDefinition | null>(null)
  const [publishConfirmOpen, setPublishConfirmOpen] = useState(false)
  const [operationFeedback, setOperationFeedback] = useState<OperationFeedbackEntry[]>([])
  const approvedAliases = aliases?.filter((alias) => alias.status === "approved") ?? []
  const canShowPublish = canPublish && approvedAliases.length > 0

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    if (!canWrite) return
    const normalizedTerm = term.trim()
    const values = parseExpansionList(expansions)
    if (!normalizedTerm || values.length === 0) return
    await onCreate({
      term: normalizedTerm,
      expansions: values,
      scope: department.trim() ? { department: department.trim() } : undefined
    })
    setTerm("")
    setExpansions("")
    setDepartment("")
  }

  return (
    <section className="admin-section-panel alias-admin-panel" aria-label="用語展開管理一覧">
      <div className="document-list-head">
        <h3>用語展開管理</h3>
        <div className="inline-action-group">
          <span>{aliases ? `${aliases.length} 件` : loadFailed ? "取得失敗" : "未提供"}</span>
          {canShowPublish && (
            <button type="button" disabled={loading} onClick={() => setPublishConfirmOpen(true)}>
              {loading && <LoadingSpinner className="button-spinner" />}
              <span>公開</span>
            </button>
          )}
        </div>
      </div>

      {operationFeedback.length > 0 && (
        <div className="admin-operation-feedback" aria-label="用語展開操作結果">
          {operationFeedback.slice(0, 3).map((entry) => <OperationFeedback key={entry.id} entry={entry} />)}
        </div>
      )}

      {canWrite && (
        <form className="alias-editor-form" onSubmit={(event) => void onSubmit(event)}>
          <label>
            <span>用語</span>
            <input value={term} onChange={(event) => setTerm(event.target.value)} placeholder="pto" disabled={loading} />
          </label>
          <label>
            <span>展開語</span>
            <input value={expansions} onChange={(event) => setExpansions(event.target.value)} placeholder="有給休暇, 休暇申請" disabled={loading} />
          </label>
          <label>
            <span>適用部署</span>
            <input value={department} onChange={(event) => setDepartment(event.target.value)} placeholder="任意" disabled={loading} />
          </label>
          <button type="submit" disabled={loading || !term.trim() || parseExpansionList(expansions).length === 0}>
            {loading && <LoadingSpinner className="button-spinner" />}
            <span>追加</span>
          </button>
        </form>
      )}

      <div className="alias-list">
        {aliases === null ? (
          <EmptyState
            title={loadFailed ? "用語展開を取得できませんでした。" : "用語展開データは未提供です。"}
            description={loadFailed ? "画面上部の状態メッセージから再試行してください。" : "権限内の応答に用語展開データがありません。"}
          />
        ) : aliases.length === 0 ? (
          <EmptyState title="登録済みの用語展開はありません。" />
        ) : (
          aliases.map((alias) => (
            <article className={`alias-card ${alias.status}`} key={alias.aliasId}>
              <div>
                <strong>{alias.term}</strong>
                <span>{alias.expansions.join(", ")}</span>
                <small>適用範囲: {alias.scope?.department ? `部署 ${alias.scope.department}` : "全体"}{alias.publishedVersion ? ` / 公開版 ${alias.publishedVersion}` : ""}</small>
                <StatusBadge presentation={aliasStatusPresentation(alias.status)} />
              </div>
              <div className="inline-action-group">
                <button type="button" disabled={!canWrite || loading || alias.status === "disabled"} onClick={() => void onUpdate(alias.aliasId, { expansions: alias.expansions })}>
                  {loading && <LoadingSpinner className="button-spinner" />}
                  <span>下書き化</span>
                </button>
                <button type="button" disabled={!canReview || loading || alias.status === "disabled"} onClick={() => void onReview(alias.aliasId, "approve")}>
                  {loading && <LoadingSpinner className="button-spinner" />}
                  <span>承認</span>
                </button>
                <button type="button" disabled={!canReview || loading || alias.status === "disabled"} onClick={() => void onReview(alias.aliasId, "reject", "画面から差し戻し")}>
                  {loading && <LoadingSpinner className="button-spinner" />}
                  <span>差戻</span>
                </button>
                <button type="button" disabled={!canDisable || loading || alias.status === "disabled"} onClick={() => setDisableCandidate(alias)}>
                  {loading && <LoadingSpinner className="button-spinner" />}
                  <span>無効</span>
                </button>
              </div>
            </article>
          ))
        )}
      </div>

      {publishConfirmOpen && (
        <ConfirmDialog
          title="用語展開を公開しますか？"
          description="承認済みの用語展開を公開バージョンへ反映します。検索時の用語展開に影響します。"
          details={[
            `対象件数: ${approvedAliases.length} 件`,
            "影響: 公開後の検索結果が変わる可能性があります",
            "回復条件: 以前の公開版へ戻す操作は現行 API で未提供です",
            "確認が必要な理由: 検索時の用語展開を全体へ反映するため"
          ]}
          confirmLabel="公開"
          tone="warning"
          loading={loading}
          onCancel={() => setPublishConfirmOpen(false)}
          onConfirm={async () => {
            const base = {
              id: "alias-publish",
              actionLabel: "用語展開公開",
              targetLabel: `承認済み ${approvedAliases.length} 件`,
              details: [
                { label: "影響", value: "公開後の検索時用語展開を変更" },
                { label: "回復条件", value: "以前の公開版へ戻す API は未提供" }
              ],
              showUnavailableEvidence: true
            }
            setOperationFeedback((current) => upsertOperationFeedback(current, processingOperationFeedback(base)))
            const outcome = await resolveOperation(onPublish)
            setOperationFeedback((current) => upsertOperationFeedback(current, feedbackFromOutcome(base, outcome)))
            if (outcome.ok) setPublishConfirmOpen(false)
          }}
        />
      )}

      {disableCandidate && (
        <ConfirmDialog
          title="この用語展開を無効化しますか？"
          description="無効化した用語展開は検索時に使われなくなります。"
          details={[
            `用語: ${disableCandidate.term}`,
            `展開語: ${disableCandidate.expansions.join(", ")}`,
            `状態: ${aliasStatusPresentation(disableCandidate.status).label}`,
            "影響: この用語展開は以後の検索で使われません",
            "回復条件: 再有効化操作は現行 API で未提供です",
            "確認が必要な理由: 検索挙動から対象を除外するため"
          ]}
          confirmLabel="無効化"
          tone="danger"
          loading={loading}
          onCancel={() => setDisableCandidate(null)}
          onConfirm={async () => {
            const target = disableCandidate
            const base = {
              id: `alias-disable-${target.aliasId}`,
              actionLabel: "用語展開無効化",
              targetLabel: target.term,
              targetId: target.aliasId,
              details: [
                { label: "影響", value: "以後の検索時用語展開から除外" },
                { label: "回復条件", value: "再有効化 API は未提供" }
              ],
              showUnavailableEvidence: true
            }
            setOperationFeedback((current) => upsertOperationFeedback(current, processingOperationFeedback(base)))
            const outcome = await resolveOperation(() => onDisable(target.aliasId))
            setOperationFeedback((current) => upsertOperationFeedback(current, feedbackFromOutcome(base, outcome)))
            if (outcome.ok) setDisableCandidate(null)
          }}
        />
      )}

      <div className="alias-audit-list" aria-label="用語展開監査ログ">
        {auditLog === null ? (
          <EmptyState
            title={loadFailed ? "用語展開の監査ログを取得できませんでした。" : "用語展開の監査ログは未提供です。"}
            description={loadFailed ? "画面上部の状態メッセージから再試行してください。" : "権限内の応答に監査ログがありません。"}
          />
        ) : auditLog.length === 0 ? (
          <EmptyState title="用語展開の監査ログはありません。" />
        ) : auditLog.slice(0, 8).map((item) => (
          <div key={item.auditId}>
            <span>{formatDateTime(item.createdAt)}</span>
            <strong>{aliasAuditActionLabel(item.action)}</strong>
            <small>{item.detail}</small>
          </div>
        ))}
      </div>
    </section>
  )
}

function parseExpansionList(value: string): string[] {
  return [...new Set(value.split(/[,\n]/).map((item) => item.trim()).filter(Boolean))]
}

async function resolveOperation<T>(operation: () => Promise<OperationOutcome<T> | void>): Promise<OperationOutcome<T>> {
  try {
    return await operation() ?? confirmedOperation<T>()
  } catch (error) {
    return failedOperation(error)
  }
}
