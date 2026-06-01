import { type FormEvent, useState } from "react"
import { ConfirmDialog } from "../../../../shared/components/ConfirmDialog.js"
import { EmptyState } from "../../../../shared/ui/index.js"
import { LoadingSpinner } from "../../../../shared/components/LoadingSpinner.js"
import { formatDateTime } from "../../../../shared/utils/format.js"
import type { AliasAuditLogItem, AliasDefinition } from "../../types.js"

export function AliasAdminPanel({
  aliases,
  auditLog,
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
  loading: boolean
  canWrite: boolean
  canReview: boolean
  canDisable: boolean
  canPublish: boolean
  onCreate: (input: { term: string; expansions: string[]; scope?: AliasDefinition["scope"] }) => Promise<void>
  onUpdate: (aliasId: string, input: { term?: string; expansions?: string[]; scope?: AliasDefinition["scope"] }) => Promise<void>
  onReview: (aliasId: string, decision: "approve" | "reject", comment?: string) => Promise<void>
  onDisable: (aliasId: string) => Promise<void>
  onPublish: () => Promise<void>
}) {
  const [term, setTerm] = useState("")
  const [expansions, setExpansions] = useState("")
  const [department, setDepartment] = useState("")
  const [disableCandidate, setDisableCandidate] = useState<AliasDefinition | null>(null)
  const [publishConfirmOpen, setPublishConfirmOpen] = useState(false)
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
    <section className="admin-section-panel alias-admin-panel" aria-label="Alias管理一覧">
      <div className="document-list-head">
        <h3>Alias管理</h3>
        <div className="inline-action-group">
          <span>{aliases ? `${aliases.length} 件` : "未提供"}</span>
          {canShowPublish && (
            <button type="button" disabled={loading} onClick={() => setPublishConfirmOpen(true)}>
              {loading && <LoadingSpinner className="button-spinner" />}
              <span>公開</span>
            </button>
          )}
        </div>
      </div>

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
            <span>部署 scope</span>
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
          <EmptyState title="Alias API field は未提供です。" description="権限内の API response に aliases field がありません。" />
        ) : aliases.length === 0 ? (
          <EmptyState title="登録済み alias はありません。" />
        ) : (
          aliases.map((alias) => (
            <article className={`alias-card ${alias.status}`} key={alias.aliasId}>
              <div>
                <strong>{alias.term}</strong>
                <span>{alias.expansions.join(", ")}</span>
                <small>{alias.scope?.department ? `department: ${alias.scope.department}` : "global"} / {alias.publishedVersion ?? alias.status}</small>
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
                <button type="button" disabled={!canReview || loading || alias.status === "disabled"} onClick={() => void onReview(alias.aliasId, "reject", "Rejected from UI")}>
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
          title="Alias を公開しますか？"
          description="承認済み alias を公開バージョンへ反映します。検索時の用語展開に影響します。"
          details={[`対象件数: ${approvedAliases.length} 件`, "影響: 公開後の検索結果が変わる可能性があります。"]}
          confirmLabel="公開"
          tone="warning"
          loading={loading}
          onCancel={() => setPublishConfirmOpen(false)}
          onConfirm={async () => {
            await onPublish()
            setPublishConfirmOpen(false)
          }}
        />
      )}

      {disableCandidate && (
        <ConfirmDialog
          title="この alias を無効化しますか？"
          description="無効化した alias は検索時の用語展開に使われなくなります。"
          details={[`用語: ${disableCandidate.term}`, `展開語: ${disableCandidate.expansions.join(", ")}`, `状態: ${disableCandidate.status}`]}
          confirmLabel="無効化"
          tone="danger"
          loading={loading}
          onCancel={() => setDisableCandidate(null)}
          onConfirm={async () => {
            await onDisable(disableCandidate.aliasId)
            setDisableCandidate(null)
          }}
        />
      )}

      <div className="alias-audit-list" aria-label="Alias監査ログ">
        {auditLog === null ? (
          <EmptyState title="Alias監査ログ API field は未提供です。" description="権限内の API response に auditLog field がありません。" />
        ) : auditLog.length === 0 ? (
          <EmptyState title="Alias監査ログはありません。" />
        ) : auditLog.slice(0, 8).map((item) => (
          <div key={item.auditId}>
            <span>{formatDateTime(item.createdAt)}</span>
            <strong>{item.action}</strong>
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
