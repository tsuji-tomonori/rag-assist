import { type FormEvent, useEffect, useState } from "react"
import { ConfirmDialog } from "../../../../shared/components/ConfirmDialog.js"
import {
  EmptyState,
  OperationFeedback,
  StatusBadge,
  failedOperation,
  feedbackFromOutcome,
  processingOperationFeedback,
  upsertOperationFeedback,
  type OperationFeedbackEntry,
  type OperationOutcome
} from "../../../../shared/ui/index.js"
import type { UiResourcePartState } from "../../../../shared/ui/ResourceState.js"
import { formatDateTime } from "../../../../shared/utils/format.js"
import { aliasAuditActionLabel, aliasStatusPresentation } from "../../../../shared/ui/displayMetadata.js"
import type { AliasAuditLogItem, AliasAuditLogPage, AliasDefinition, AliasListPage } from "../../types.js"
import { aliasAuditActions, type AdminWorkspaceUrlState } from "../../urlState.js"
import { AdminPanelDataStatus } from "../AdminPanelDataStatus.js"

type AliasCommand = "approve" | "reject" | "transition" | "disable"

export function AliasAdminPanel({
  page,
  auditPage,
  listPart,
  auditPart,
  loading,
  canWrite,
  canReview,
  canDisable,
  canPublish,
  urlState,
  onUrlStateChange,
  onRefreshList,
  onRefreshAudit,
  onLoadMore,
  onLoadMoreAudit,
  onCreate,
  onUpdate,
  onReview,
  onTransition,
  onDisable,
  onPublish
}: {
  page: AliasListPage | null
  auditPage: AliasAuditLogPage | null
  listPart?: UiResourcePartState
  auditPart?: UiResourcePartState
  loading: boolean
  canWrite: boolean
  canReview: boolean
  canDisable: boolean
  canPublish: boolean
  urlState: AdminWorkspaceUrlState
  onUrlStateChange: (state: AdminWorkspaceUrlState, mode?: "push" | "replace") => void
  onRefreshList: () => Promise<void>
  onRefreshAudit: () => Promise<void>
  onLoadMore: () => Promise<void>
  onLoadMoreAudit: () => Promise<void>
  onCreate: (input: { term: string; expansions: string[]; scope?: AliasDefinition["scope"] }) => Promise<OperationOutcome<AliasDefinition> | void>
  onUpdate: (aliasId: string, input: { term?: string; expansions?: string[]; scope?: AliasDefinition["scope"]; expectedVersion: string; reason: string }) => Promise<OperationOutcome<AliasDefinition> | void>
  onReview: (aliasId: string, decision: "approve" | "reject", expectedVersion: string, reason: string) => Promise<OperationOutcome<AliasDefinition> | void>
  onTransition: (aliasId: string, expectedVersion: string, reason: string) => Promise<OperationOutcome<AliasDefinition> | void>
  onDisable: (aliasId: string, expectedVersion: string, reason: string) => Promise<OperationOutcome<AliasDefinition> | void>
  onPublish: (expectedVersion: string, reason: string) => Promise<OperationOutcome<{ version: string; publishedAt: string; aliasCount: number }> | void>
}) {
  const [term, setTerm] = useState("")
  const [expansions, setExpansions] = useState("")
  const [department, setDepartment] = useState("")
  const [query, setQuery] = useState(urlState.query ?? "")
  const [commandCandidate, setCommandCandidate] = useState<{ alias: AliasDefinition; command: AliasCommand } | null>(null)
  const [editCandidate, setEditCandidate] = useState<AliasDefinition | null>(null)
  const [editTerm, setEditTerm] = useState("")
  const [editExpansions, setEditExpansions] = useState("")
  const [reason, setReason] = useState("")
  const [publishConfirmOpen, setPublishConfirmOpen] = useState(false)
  const [operationFeedback, setOperationFeedback] = useState<OperationFeedbackEntry[]>([])
  const aliases = page?.aliases ?? null
  const auditLog = auditPage?.auditLog ?? null
  const auditAction = urlState.auditAction && aliasAuditActions.has(urlState.auditAction as AliasAuditLogItem["action"])
    ? urlState.auditAction as AliasAuditLogItem["action"]
    : ""
  const listFailed = listPart?.status === "failed" || listPart?.status === "permission"
  const auditFailed = auditPart?.status === "failed" || auditPart?.status === "permission"

  useEffect(() => setQuery(urlState.query ?? ""), [urlState.query])

  async function submitCreate(event: FormEvent) {
    event.preventDefault()
    if (!canWrite) return
    const normalizedTerm = term.trim()
    const values = parseExpansionList(expansions)
    if (!normalizedTerm || values.length === 0) return
    const base = operationBase("alias-create", "用語展開作成", normalizedTerm)
    setOperationFeedback((current) => upsertOperationFeedback(current, processingOperationFeedback(base)))
    const outcome = await resolveOperation(() => onCreate({
      term: normalizedTerm,
      expansions: values,
      scope: department.trim() ? { department: department.trim() } : undefined
    }))
    setOperationFeedback((current) => upsertOperationFeedback(current, feedbackFromOutcome(base, outcome)))
    if (outcome.ok) {
      setTerm("")
      setExpansions("")
      setDepartment("")
    }
  }

  function applyFilters(event: FormEvent) {
    event.preventDefault()
    onUrlStateChange({ ...urlState, section: "alias", query: query.trim() || undefined, selected: undefined }, "push")
  }

  function openEdit(alias: AliasDefinition) {
    setEditCandidate(alias)
    setEditTerm(alias.term)
    setEditExpansions(alias.expansions.join(", "))
    setReason("")
  }

  return (
    <section className="admin-section-panel alias-admin-panel" aria-label="用語展開管理一覧">
      <div className="document-list-head">
        <h3>用語展開管理</h3>
        <div className="inline-action-group">
          <span>{page ? `${page.aliases.length} / ${page.total} 件` : listFailed ? "取得失敗" : "未確認"}</span>
          {canPublish && page?.version && (
            <button type="button" disabled={loading} onClick={() => { setReason(""); setPublishConfirmOpen(true) }} aria-label="承認済み用語展開を公開">
              公開
            </button>
          )}
        </div>
      </div>

      <AdminPanelDataStatus label="用語展開一覧" part={listPart} source={page?.source} asOf={page?.asOf} loading={loading} onRefresh={onRefreshList} />

      <form className="admin-filter-form" onSubmit={applyFilters} role="search" aria-label="用語展開を絞り込む">
        <label>
          <span>用語・展開語を検索</span>
          <input value={query} maxLength={200} onChange={(event) => setQuery(event.target.value)} />
        </label>
        <label>
          <span>状態</span>
          <select value={urlState.aliasStatus ?? ""} onChange={(event) => onUrlStateChange({
            ...urlState,
            section: "alias",
            aliasStatus: event.target.value as AliasDefinition["status"] || undefined,
            selected: undefined
          })}>
            <option value="">すべて</option>
            <option value="draft">下書き</option>
            <option value="approved">承認済み</option>
            <option value="disabled">無効</option>
          </select>
        </label>
        <label>
          <span>並び順</span>
          <select value={urlState.sort ?? "updatedDesc"} onChange={(event) => onUrlStateChange({
            ...urlState,
            section: "alias",
            sort: event.target.value as "updatedDesc" | "termAsc",
            selected: undefined
          })}>
            <option value="updatedDesc">更新が新しい順</option>
            <option value="termAsc">用語順</option>
          </select>
        </label>
        <button type="submit" disabled={loading}>検索</button>
        {(urlState.query || urlState.aliasStatus || urlState.sort && urlState.sort !== "updatedDesc") && (
          <button type="button" disabled={loading} onClick={() => {
            setQuery("")
            onUrlStateChange({ ...urlState, section: "alias", query: undefined, aliasStatus: undefined, sort: undefined, selected: undefined }, "push")
          }}>条件を解除</button>
        )}
      </form>

      {operationFeedback.length > 0 && (
        <div className="admin-operation-feedback" aria-label="用語展開操作結果" aria-live="polite">
          {operationFeedback.slice(0, 3).map((entry) => <OperationFeedback key={entry.id} entry={entry} />)}
        </div>
      )}

      {canWrite && (
        <form className="alias-editor-form" onSubmit={(event) => void submitCreate(event)}>
          <label>
            <span>用語</span>
            <input value={term} onChange={(event) => setTerm(event.target.value)} disabled={loading} />
          </label>
          <label>
            <span>展開語（カンマまたは改行区切り）</span>
            <textarea value={expansions} onChange={(event) => setExpansions(event.target.value)} disabled={loading} />
          </label>
          <label>
            <span>適用部署（任意）</span>
            <input value={department} onChange={(event) => setDepartment(event.target.value)} disabled={loading} />
          </label>
          <button type="submit" disabled={loading || !term.trim() || parseExpansionList(expansions).length === 0}>下書きを追加</button>
        </form>
      )}

      <div className="alias-list">
        {aliases === null ? (
          <EmptyState
            title={listFailed ? "用語展開を取得できませんでした。" : "用語展開をまだ確認できません。"}
            description={listFailed ? "用語展開一覧の更新を試してください。" : "管理 API の取得完了後に表示します。"}
          />
        ) : aliases.length === 0 ? (
          <EmptyState title="条件に一致する用語展開はありません。" />
        ) : (
          aliases.map((alias) => (
            <article
              className={`alias-card ${alias.status}${urlState.selected === alias.aliasId ? " selected" : ""}`}
              aria-current={urlState.selected === alias.aliasId ? "true" : undefined}
              key={alias.aliasId}
            >
              <div>
                <strong>{alias.term}</strong>
                <span>{alias.expansions.join("、")}</span>
                <small>適用範囲: {alias.scope?.department ? `部署 ${alias.scope.department}` : "テナント全体"}</small>
                <small>version: <code>{alias.version}</code>{alias.publishedVersion ? ` / 公開版 ${alias.publishedVersion}` : ""}</small>
                <StatusBadge presentation={aliasStatusPresentation(alias.status)} />
              </div>
              <div className="alias-card-actions">
                <button type="button" onClick={() => onUrlStateChange({
                  ...urlState,
                  section: "alias",
                  selected: urlState.selected === alias.aliasId ? undefined : alias.aliasId
                })} aria-label={`${alias.term}の監査ログを${urlState.selected === alias.aliasId ? "全件表示へ戻す" : "絞り込む"}`}>
                  {urlState.selected === alias.aliasId ? "監査絞込を解除" : "監査を絞込"}
                </button>
                {canWrite && alias.status === "draft" && (
                  <button type="button" disabled={loading} onClick={() => openEdit(alias)} aria-label={`${alias.term}を編集`}>編集</button>
                )}
                {canReview && alias.status === "draft" && (
                  <>
                    <button type="button" disabled={loading} onClick={() => { setReason(""); setCommandCandidate({ alias, command: "approve" }) }} aria-label={`${alias.term}を承認`}>承認</button>
                    <button type="button" disabled={loading} onClick={() => { setReason(""); setCommandCandidate({ alias, command: "reject" }) }} aria-label={`${alias.term}を差し戻し`}>差し戻し</button>
                  </>
                )}
                {canWrite && alias.status === "approved" && (
                  <button type="button" disabled={loading} onClick={() => { setReason(""); setCommandCandidate({ alias, command: "transition" }) }} aria-label={`${alias.term}を下書きへ戻す`}>下書きへ戻す</button>
                )}
                {canDisable && alias.status !== "disabled" && (
                  <button type="button" disabled={loading} onClick={() => { setReason(""); setCommandCandidate({ alias, command: "disable" }) }} aria-label={`${alias.term}を無効化`}>無効化</button>
                )}
              </div>
            </article>
          ))
        )}
      </div>
      {page?.nextCursor && (
        <button type="button" className="admin-load-more" disabled={loading} onClick={() => void onLoadMore()}>
          次の用語展開を読み込む（残り {Math.max(0, page.total - page.aliases.length)} 件）
        </button>
      )}

      <div className="document-list-head alias-audit-heading">
        <h4>用語展開監査ログ</h4>
        <span>{auditPage ? `${auditPage.auditLog.length} / ${auditPage.total} 件` : auditFailed ? "取得失敗" : "未確認"}</span>
      </div>
      <AdminPanelDataStatus label="用語展開監査ログ" part={auditPart} source={auditPage?.source} asOf={auditPage?.asOf} loading={loading} onRefresh={onRefreshAudit} />
      <label className="admin-audit-action-filter">
        <span>監査操作</span>
        <select value={auditAction} onChange={(event) => onUrlStateChange({
          ...urlState,
          section: "alias",
          auditAction: event.target.value as AliasAuditLogItem["action"] || undefined
        })}>
          <option value="">すべて</option>
          <option value="create">作成</option>
          <option value="update">更新</option>
          <option value="review">レビュー</option>
          <option value="transition">状態遷移</option>
          <option value="disable">無効化</option>
          <option value="publish">公開</option>
        </select>
      </label>
      <div className="alias-audit-list" aria-label="用語展開監査ログ">
        {auditLog === null ? (
          <EmptyState
            title={auditFailed ? "用語展開の監査ログを取得できませんでした。" : "用語展開の監査ログをまだ確認できません。"}
            description={auditFailed ? "監査ログの更新を試してください。" : "管理 API の取得完了後に表示します。"}
          />
        ) : auditLog.length === 0 ? (
          <EmptyState title="条件に一致する用語展開の監査ログはありません。" />
        ) : auditLog.map((item) => (
          <article key={item.auditId}>
            <div>
              <strong>{aliasAuditActionLabel(item.action)}</strong>
              <span>{auditResultLabel(item.result)}</span>
              <time dateTime={item.createdAt}>{formatDateTime(item.createdAt)}</time>
            </div>
            <small>{item.detail}</small>
            <dl>
              <div><dt>実行者</dt><dd>{item.actorUserId}</dd></div>
              <div><dt>理由</dt><dd>{item.reason}</dd></div>
              <div><dt>状態</dt><dd>{statusTransition(item)}</dd></div>
              <div><dt>version</dt><dd>{item.aliasVersion || "対象外"}</dd></div>
              <div><dt>監査 ID</dt><dd><code>{item.auditId}</code></dd></div>
            </dl>
          </article>
        ))}
      </div>
      {auditPage?.nextCursor && (
        <button type="button" className="admin-load-more" disabled={loading} onClick={() => void onLoadMoreAudit()}>
          次の監査ログを読み込む（残り {Math.max(0, auditPage.total - auditPage.auditLog.length)} 件）
        </button>
      )}

      {commandCandidate && (
        <ConfirmDialog
          title={commandDialogTitle(commandCandidate.command)}
          description="画面に表示した version と理由を API に送り、server が状態遷移を検証します。"
          details={[
            `用語: ${commandCandidate.alias.term}`,
            `現在の状態: ${aliasStatusPresentation(commandCandidate.alias.status).label}`,
            `expected version: ${commandCandidate.alias.version}`,
            `影響: ${commandImpact(commandCandidate.command)}`,
            "回復条件: 最新状態を更新し、許可された明示的な遷移を理由付きで実行します"
          ]}
          confirmLabel={commandLabel(commandCandidate.command)}
          tone={commandCandidate.command === "disable" ? "danger" : "warning"}
          loading={loading}
          confirmDisabled={!reason.trim()}
          onCancel={() => { setCommandCandidate(null); setReason("") }}
          onConfirm={async () => {
            const candidate = commandCandidate
            const normalizedReason = reason.trim()
            if (!normalizedReason) return
            const base = operationBase(`alias-${candidate.command}-${candidate.alias.aliasId}`, commandLabel(candidate.command), candidate.alias.term, normalizedReason)
            setOperationFeedback((current) => upsertOperationFeedback(current, processingOperationFeedback(base)))
            const outcome = await executeAliasCommand(candidate, normalizedReason, { onReview, onTransition, onDisable })
            setOperationFeedback((current) => upsertOperationFeedback(current, feedbackFromOutcome(base, outcome)))
            if (outcome.ok) {
              setCommandCandidate(null)
              setReason("")
            }
          }}
        >
          <ReasonField value={reason} onChange={setReason} />
        </ConfirmDialog>
      )}

      {editCandidate && (
        <ConfirmDialog
          title={`${editCandidate.term}を更新しますか？`}
          description="変更内容、expected version、理由を server に送り、競合時は更新せず再取得を促します。"
          details={[
            `変更前: ${editCandidate.term} → ${editCandidate.expansions.join("、")}`,
            `変更後: ${editTerm.trim()} → ${parseExpansionList(editExpansions).join("、") || "未入力"}`,
            `expected version: ${editCandidate.version}`,
            "影響: 更新後も下書きとしてレビュー待ちになります"
          ]}
          confirmLabel="更新"
          tone="warning"
          loading={loading}
          confirmDisabled={!reason.trim() || !editTerm.trim() || parseExpansionList(editExpansions).length === 0}
          onCancel={() => { setEditCandidate(null); setReason("") }}
          onConfirm={async () => {
            const candidate = editCandidate
            const normalizedReason = reason.trim()
            if (!normalizedReason) return
            const base = operationBase(`alias-update-${candidate.aliasId}`, "用語展開更新", candidate.term, normalizedReason)
            setOperationFeedback((current) => upsertOperationFeedback(current, processingOperationFeedback(base)))
            const outcome = await resolveOperation(() => onUpdate(candidate.aliasId, {
              term: editTerm.trim(),
              expansions: parseExpansionList(editExpansions),
              scope: candidate.scope,
              expectedVersion: candidate.version,
              reason: normalizedReason
            }))
            setOperationFeedback((current) => upsertOperationFeedback(current, feedbackFromOutcome(base, outcome)))
            if (outcome.ok) {
              setEditCandidate(null)
              setReason("")
            }
          }}
        >
          <div className="alias-edit-fields">
            <label><span>用語</span><input value={editTerm} onChange={(event) => setEditTerm(event.target.value)} /></label>
            <label><span>展開語</span><textarea value={editExpansions} onChange={(event) => setEditExpansions(event.target.value)} /></label>
            <ReasonField value={reason} onChange={setReason} />
          </div>
        </ConfirmDialog>
      )}

      {publishConfirmOpen && page?.version && (
        <ConfirmDialog
          title="承認済みの用語展開を公開しますか？"
          description="server がこのテナントの承認済み定義を選び、検索用の公開版を作成します。"
          details={[
            `expected ledger version: ${page.version}`,
            "対象: server が公開時点に承認済みと確認した同一テナントの定義",
            "影響: 公開後の検索時用語展開が変わります",
            "回復条件: 以前の公開版へ戻す UI/API は現時点で未提供です"
          ]}
          confirmLabel="公開"
          tone="warning"
          loading={loading}
          confirmDisabled={!reason.trim()}
          onCancel={() => { setPublishConfirmOpen(false); setReason("") }}
          onConfirm={async () => {
            const normalizedReason = reason.trim()
            if (!normalizedReason) return
            const base = operationBase("alias-publish", "用語展開公開", "同一テナントの承認済み定義", normalizedReason)
            setOperationFeedback((current) => upsertOperationFeedback(current, processingOperationFeedback(base)))
            const outcome = await resolveOperation(() => onPublish(page.version!, normalizedReason))
            setOperationFeedback((current) => upsertOperationFeedback(current, feedbackFromOutcome(base, outcome)))
            if (outcome.ok) {
              setPublishConfirmOpen(false)
              setReason("")
            }
          }}
        >
          <ReasonField value={reason} onChange={setReason} />
        </ConfirmDialog>
      )}
    </section>
  )
}

function ReasonField({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  return (
    <label className="admin-reason-field">
      <span>実行理由（必須）</span>
      <textarea value={value} maxLength={1000} required onChange={(event) => onChange(event.target.value)} />
    </label>
  )
}

function parseExpansionList(value: string): string[] {
  return [...new Set(value.split(/[,\n]/).map((item) => item.trim()).filter(Boolean))]
}

async function executeAliasCommand(
  candidate: { alias: AliasDefinition; command: AliasCommand },
  reason: string,
  operations: {
    onReview: (aliasId: string, decision: "approve" | "reject", expectedVersion: string, reason: string) => Promise<OperationOutcome<AliasDefinition> | void>
    onTransition: (aliasId: string, expectedVersion: string, reason: string) => Promise<OperationOutcome<AliasDefinition> | void>
    onDisable: (aliasId: string, expectedVersion: string, reason: string) => Promise<OperationOutcome<AliasDefinition> | void>
  }
): Promise<OperationOutcome<AliasDefinition>> {
  const { alias, command } = candidate
  if (command === "approve" || command === "reject") {
    return resolveOperation(() => operations.onReview(alias.aliasId, command, alias.version, reason))
  }
  if (command === "transition") return resolveOperation(() => operations.onTransition(alias.aliasId, alias.version, reason))
  return resolveOperation(() => operations.onDisable(alias.aliasId, alias.version, reason))
}

function commandLabel(command: AliasCommand): string {
  if (command === "approve") return "承認"
  if (command === "reject") return "差し戻し"
  if (command === "transition") return "下書きへ戻す"
  return "無効化"
}

function commandDialogTitle(command: AliasCommand): string {
  if (command === "transition") return "下書きへ戻しますか？"
  return `${commandLabel(command)}しますか？`
}

function commandImpact(command: AliasCommand): string {
  if (command === "approve") return "公開候補として承認済み状態へ変更します"
  if (command === "reject") return "下書きの内容を差し戻しとして記録します"
  if (command === "transition") return "承認を取り消し、編集可能な下書きへ戻します"
  return "以後の公開版に含めない無効状態へ変更します"
}

function operationBase(id: string, actionLabel: string, targetLabel: string, reason?: string) {
  return {
    id,
    actionLabel,
    targetLabel,
    reason,
    details: reason ? [{ label: "理由", value: reason }] : undefined,
    showUnavailableEvidence: true
  }
}

function auditResultLabel(result: AliasAuditLogItem["result"]): string {
  if (result === "success") return "成功"
  if (result === "denied") return "拒否"
  if (result === "conflict") return "競合"
  return "失敗"
}

function statusTransition(item: AliasAuditLogItem): string {
  if (!item.beforeStatus && !item.afterStatus) return "状態変更なし"
  return `${item.beforeStatus ? aliasStatusPresentation(item.beforeStatus).label : "なし"} → ${item.afterStatus ? aliasStatusPresentation(item.afterStatus).label : "なし"}`
}

async function resolveOperation<T>(operation: () => Promise<OperationOutcome<T> | void>): Promise<OperationOutcome<T>> {
  try {
    return await operation() ?? failedOperation(new Error("API の操作結果を確認できませんでした。"))
  } catch (error) {
    return failedOperation(error)
  }
}
