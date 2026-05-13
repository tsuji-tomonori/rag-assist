import { render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"
import type { DocumentGroup, DocumentManifest, ReindexMigration } from "../types.js"
import { DocumentWorkspace } from "./DocumentWorkspace.js"

const documents = [
  { documentId: "doc-1", fileName: "requirements.md", chunkCount: 2, memoryCardCount: 1, createdAt: "2026-05-01T00:00:00.000Z" }
]

const typedDocuments = [
  { documentId: "doc-tex", fileName: "requirements.tex", chunkCount: 30, memoryCardCount: 20, createdAt: "2026-05-02T00:00:00.000Z" },
  { documentId: "doc-pdf", fileName: "security_policy.bin", mimeType: "application/pdf", chunkCount: 18, memoryCardCount: 3, createdAt: "2026-05-03T00:00:00.000Z" },
  { documentId: "doc-word", fileName: "onboarding.docx", chunkCount: 7, memoryCardCount: 2, createdAt: "2026-05-04T00:00:00.000Z" },
  { documentId: "doc-ppt", fileName: "architecture.pptx", chunkCount: 12, memoryCardCount: 4, createdAt: "2026-05-05T00:00:00.000Z" },
  { documentId: "doc-csv", fileName: "inventory.csv", chunkCount: 1, memoryCardCount: 0, createdAt: "2026-05-06T00:00:00.000Z" }
]

const paginatedDocuments = Array.from({ length: 30 }, (_, index) => {
  const serial = String(index + 1).padStart(2, "0")
  return {
    documentId: `doc-page-${serial}`,
    fileName: `policy-${serial}.pdf`,
    mimeType: "application/pdf",
    chunkCount: index + 1,
    memoryCardCount: 0,
    createdAt: `2026-05-${serial}T00:00:00.000Z`
  }
})

const documentGroups: DocumentGroup[] = [
  {
    groupId: "group-1",
    name: "社内規定",
    visibility: "private",
    ownerUserId: "user-1",
    sharedUserIds: [],
    sharedGroups: ["HR"],
    managerUserIds: ["user-1"],
    createdAt: "2026-05-01T00:00:00.000Z",
    updatedAt: "2026-05-01T00:00:00.000Z"
  }
]

const organizationGroup: DocumentGroup = {
  groupId: "group-org",
  name: "全社公開",
  visibility: "org",
  ownerUserId: "user-1",
  sharedUserIds: ["user-2"],
  sharedGroups: [],
  managerUserIds: ["user-1"],
  createdAt: "2026-05-01T00:00:00.000Z",
  updatedAt: "2026-05-01T00:00:00.000Z"
}

const migrations: ReindexMigration[] = [
  {
    migrationId: "migration-1",
    sourceDocumentId: "doc-1",
    stagedDocumentId: "doc-1-staged",
    status: "staged" as const,
    createdBy: "user-1",
    createdAt: "2026-05-02T00:00:00.000Z",
    updatedAt: "2026-05-02T00:00:00.000Z",
    previousManifestObjectKey: "manifests/doc-1.json",
    stagedManifestObjectKey: "manifests/doc-1-staged.json"
  },
  {
    migrationId: "migration-2",
    sourceDocumentId: "doc-2",
    stagedDocumentId: "doc-2-staged",
    status: "cutover" as const,
    createdBy: "user-1",
    createdAt: "2026-05-02T00:00:00.000Z",
    updatedAt: "2026-05-03T00:00:00.000Z",
    previousManifestObjectKey: "manifests/doc-2.json",
    stagedManifestObjectKey: "manifests/doc-2-staged.json"
  }
]

const documentGroupProps = {
  documentGroups: [],
  uploadGroupId: "",
  onUploadGroupChange: vi.fn(),
  onCreateGroup: vi.fn(),
  onShareGroup: vi.fn()
}

function createDeferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void
  let reject!: (reason?: unknown) => void
  const promise = new Promise<T>((nextResolve, nextReject) => {
    resolve = nextResolve
    reject = nextReject
  })
  return { promise, resolve, reject }
}

describe("DocumentWorkspace", () => {
  it("登録文書を表示し、削除操作を通知する", async () => {
    const onDelete = vi.fn().mockResolvedValue(undefined)

    render(
      <DocumentWorkspace
        documents={documents}
        {...documentGroupProps}
        loading={false}
        canWrite={true}
        canDelete={true}
        canReindex={true}
        migrations={migrations}
        onUpload={vi.fn()}
        onDelete={onDelete}
        onStageReindex={vi.fn()}
        onCutoverReindex={vi.fn()}
        onRollbackReindex={vi.fn()}
        onBack={vi.fn()}
      />
    )

    expect(screen.getAllByText("requirements.md").length).toBeGreaterThanOrEqual(1)

    await userEvent.click(screen.getByTitle("requirements.mdを削除"))
    expect(screen.getByRole("dialog", { name: "文書を削除しますか" })).toBeInTheDocument()
    expect(screen.getByText("documentId")).toBeInTheDocument()
    await userEvent.click(screen.getByRole("button", { name: "削除" }))

    expect(onDelete).toHaveBeenCalledWith("doc-1")
  })

  it("文書行にモバイルカード用の表示情報を持たせる", () => {
    const { container } = render(
      <DocumentWorkspace
        documents={[{ ...documents[0]!, metadata: { groupIds: ["group-1"] } }]}
        documentGroups={documentGroups}
        uploadGroupId=""
        loading={false}
        canWrite={true}
        canDelete={true}
        canReindex={true}
        migrations={[]}
        onUploadGroupChange={vi.fn()}
        onUpload={vi.fn()}
        onCreateGroup={vi.fn()}
        onShareGroup={vi.fn()}
        onDelete={vi.fn()}
        onStageReindex={vi.fn()}
        onCutoverReindex={vi.fn()}
        onRollbackReindex={vi.fn()}
        onBack={vi.fn()}
      />
    )

    const row = screen.getByRole("row", { name: "requirements.mdの詳細を表示" })
    expect(screen.getByRole("columnheader", { name: "所属フォルダ" })).toBeInTheDocument()
    expect(within(row).getByText("社内規定")).toBeInTheDocument()
    expect(screen.getByTitle("requirements.md")).toBeInTheDocument()
    expect(container.querySelector('[data-label="ファイル名"]')).not.toBeNull()
    expect(container.querySelector('[data-label="所属フォルダ"]')).not.toBeNull()
    expect(container.querySelector('[data-label="操作"] .document-action-buttons')).not.toBeNull()
  })

  it("文書一覧をページ分割し、表示件数とページ移動を操作できる", async () => {
    render(
      <DocumentWorkspace
        documents={paginatedDocuments}
        {...documentGroupProps}
        loading={false}
        canWrite={true}
        canDelete={true}
        canReindex={true}
        migrations={[]}
        onUpload={vi.fn()}
        onDelete={vi.fn()}
        onStageReindex={vi.fn()}
        onCutoverReindex={vi.fn()}
        onRollbackReindex={vi.fn()}
        onBack={vi.fn()}
      />
    )

    const table = screen.getByRole("table", { name: "登録文書" })
    expect(screen.getByText("1-25 / 30 件を表示（フォルダ内 30 件 / 全体 30 件）")).toBeInTheDocument()
    expect(screen.getByText("ページ 1 / 2")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "前のページ" })).toBeDisabled()
    expect(screen.getByRole("button", { name: "次のページ" })).toBeEnabled()
    expect(within(table).getByText("policy-30.pdf")).toBeInTheDocument()
    expect(within(table).queryByText("policy-05.pdf")).not.toBeInTheDocument()

    await userEvent.click(screen.getByRole("button", { name: "次のページ" }))

    expect(screen.getByText("26-30 / 30 件を表示（フォルダ内 30 件 / 全体 30 件）")).toBeInTheDocument()
    expect(screen.getByText("ページ 2 / 2")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "次のページ" })).toBeDisabled()
    expect(within(table).getByText("policy-05.pdf")).toBeInTheDocument()
    expect(within(table).queryByText("policy-30.pdf")).not.toBeInTheDocument()

    await userEvent.selectOptions(screen.getByLabelText("表示件数"), "50")

    expect(screen.getByText("1-30 / 30 件を表示（フォルダ内 30 件 / 全体 30 件）")).toBeInTheDocument()
    expect(screen.getByText("ページ 1 / 1")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "次のページ" })).toBeDisabled()
    expect(within(table).getByText("policy-30.pdf")).toBeInTheDocument()
  })

  it("更新日列と更新日ソートは文書更新日時を優先する", async () => {
    render(
      <DocumentWorkspace
        documents={[
          { documentId: "doc-created", fileName: "created-only.md", chunkCount: 1, memoryCardCount: 0, createdAt: "2026-05-01T00:00:00.000Z" },
          { documentId: "doc-top-level", fileName: "top-level-updated.md", chunkCount: 1, memoryCardCount: 0, createdAt: "2026-05-01T00:00:00.000Z", updatedAt: "2026-05-08T00:00:00.000Z" },
          { documentId: "doc-metadata", fileName: "metadata-updated.md", chunkCount: 1, memoryCardCount: 0, createdAt: "2026-05-01T00:00:00.000Z", updatedAt: "2026-05-02T00:00:00.000Z", metadata: { updatedAt: "2026-05-09T00:00:00.000Z" } }
        ]}
        {...documentGroupProps}
        loading={false}
        canWrite={true}
        canDelete={true}
        canReindex={true}
        migrations={[]}
        onUpload={vi.fn()}
        onDelete={vi.fn()}
        onStageReindex={vi.fn()}
        onCutoverReindex={vi.fn()}
        onRollbackReindex={vi.fn()}
        onBack={vi.fn()}
      />
    )

    const table = screen.getByRole("table", { name: "登録文書" })
    const documentRows = within(table).getAllByRole("row").slice(1)
    expect(documentRows.map((row) => row.textContent)).toEqual([
      expect.stringContaining("metadata-updated.md"),
      expect.stringContaining("top-level-updated.md"),
      expect.stringContaining("created-only.md")
    ])
    expect(within(documentRows[0]!).getByText(/2026\/05\/09/)).toBeInTheDocument()
    expect(within(documentRows[1]!).getByText(/2026\/05\/08/)).toBeInTheDocument()
    expect(within(documentRows[2]!).getByText(/2026\/05\/01/)).toBeInTheDocument()

    await userEvent.selectOptions(screen.getByLabelText("並び替え"), "updatedAsc")

    expect(within(table).getAllByRole("row").slice(1).map((row) => row.textContent)).toEqual([
      expect.stringContaining("created-only.md"),
      expect.stringContaining("top-level-updated.md"),
      expect.stringContaining("metadata-updated.md")
    ])
  })

  it("検索条件の変更時に文書一覧ページを先頭へ戻す", async () => {
    render(
      <DocumentWorkspace
        documents={paginatedDocuments}
        {...documentGroupProps}
        loading={false}
        canWrite={true}
        canDelete={true}
        canReindex={true}
        migrations={[]}
        onUpload={vi.fn()}
        onDelete={vi.fn()}
        onStageReindex={vi.fn()}
        onCutoverReindex={vi.fn()}
        onRollbackReindex={vi.fn()}
        onBack={vi.fn()}
      />
    )

    await userEvent.click(screen.getByRole("button", { name: "次のページ" }))
    expect(screen.getByText("ページ 2 / 2")).toBeInTheDocument()

    await userEvent.type(screen.getByLabelText("ファイル名検索"), "policy-30")

    expect(screen.getByText("1-1 / 1 件を表示（フォルダ内 30 件 / 全体 30 件）")).toBeInTheDocument()
    expect(screen.getByText("ページ 1 / 1")).toBeInTheDocument()
    expect(within(screen.getByRole("table", { name: "登録文書" })).getByText("policy-30.pdf")).toBeInTheDocument()
  })

  it("削除権限がない場合は削除ボタンを無効化する", () => {
    render(
      <DocumentWorkspace
        documents={documents}
        {...documentGroupProps}
        loading={false}
        canWrite={true}
        canDelete={false}
        canReindex={false}
        migrations={[]}
        onUpload={vi.fn()}
        onDelete={vi.fn()}
        onStageReindex={vi.fn()}
        onCutoverReindex={vi.fn()}
        onRollbackReindex={vi.fn()}
        onBack={vi.fn()}
      />
    )

    expect(screen.getByTitle("requirements.mdを削除")).toBeDisabled()
  })

  it("再インデックスのステージング、切替、戻し操作を通知する", async () => {
    const onStageReindex = vi.fn().mockResolvedValue(undefined)
    const onCutoverReindex = vi.fn().mockResolvedValue(undefined)
    const onRollbackReindex = vi.fn().mockResolvedValue(undefined)

    render(
      <DocumentWorkspace
        documents={documents}
        {...documentGroupProps}
        loading={false}
        canWrite={true}
        canDelete={true}
        canReindex={true}
        migrations={migrations}
        onUpload={vi.fn()}
        onDelete={vi.fn()}
        onStageReindex={onStageReindex}
        onCutoverReindex={onCutoverReindex}
        onRollbackReindex={onRollbackReindex}
        onBack={vi.fn()}
      />
    )

    await userEvent.click(screen.getByTitle("requirements.mdの再インデックスをステージング"))
    expect(screen.getByRole("dialog", { name: "再インデックスをステージングしますか" })).toBeInTheDocument()
    await userEvent.click(screen.getByRole("button", { name: "ステージング" }))
    await userEvent.click(screen.getAllByRole("button", { name: "切替" })[0]!)
    expect(screen.getByRole("dialog", { name: "再インデックス結果へ切り替えますか" })).toBeInTheDocument()
    await userEvent.click(within(screen.getByRole("dialog", { name: "再インデックス結果へ切り替えますか" })).getByRole("button", { name: "切替" }))
    await userEvent.click(screen.getAllByRole("button", { name: "戻す" })[1]!)
    expect(screen.getByRole("dialog", { name: "再インデックス切替を戻しますか" })).toBeInTheDocument()
    await userEvent.click(within(screen.getByRole("dialog", { name: "再インデックス切替を戻しますか" })).getByRole("button", { name: "戻す" }))

    expect(onStageReindex).toHaveBeenCalledWith("doc-1")
    expect(onCutoverReindex).toHaveBeenCalledWith("migration-1")
    expect(onRollbackReindex).toHaveBeenCalledWith("migration-2")
  })

  it("最近の操作に実データと現在セッション操作を表示する", async () => {
    const onDelete = vi.fn().mockResolvedValue(undefined)

    render(
      <DocumentWorkspace
        documents={documents}
        documentGroups={documentGroups}
        uploadGroupId=""
        loading={false}
        canWrite={true}
        canDelete={true}
        canReindex={true}
        migrations={migrations}
        onUploadGroupChange={vi.fn()}
        onUpload={vi.fn()}
        onCreateGroup={vi.fn()}
        onShareGroup={vi.fn()}
        onDelete={onDelete}
        onStageReindex={vi.fn()}
        onCutoverReindex={vi.fn()}
        onRollbackReindex={vi.fn()}
        onBack={vi.fn()}
      />
    )

    const recentOperations = screen.getByRole("list", { name: "最近の操作" })
    expect(screen.getByRole("heading", { name: "最近の操作" })).toBeInTheDocument()
    expect(within(recentOperations).getByText("文書更新")).toBeInTheDocument()
    expect(within(recentOperations).getByText("フォルダ作成")).toBeInTheDocument()
    expect(within(recentOperations).getByText("reindex stage")).toBeInTheDocument()
    expect(within(recentOperations).getAllByText("反映済み").length).toBeGreaterThanOrEqual(1)
    expect(within(recentOperations).getAllByText("user-1").length).toBeGreaterThanOrEqual(1)
    expect(screen.getByText(/監査ログ API は未接続です/)).toBeInTheDocument()

    await userEvent.click(screen.getByTitle("requirements.mdを削除"))
    await userEvent.click(screen.getByRole("button", { name: "削除" }))

    expect(onDelete).toHaveBeenCalledWith("doc-1")
    expect(within(recentOperations).getByText("文書削除")).toBeInTheDocument()
    expect(within(recentOperations).getAllByText("反映済み").length).toBeGreaterThanOrEqual(1)
  })

  it("確認ダイアログは処理中の二重実行を防ぎ、成功後に閉じる", async () => {
    const deferred = createDeferred<void>()
    const onDelete = vi.fn().mockReturnValue(deferred.promise.then(() => ({ ok: true as const })))

    render(
      <DocumentWorkspace
        documents={documents}
        documentGroups={documentGroups}
        uploadGroupId=""
        loading={false}
        canWrite={true}
        canDelete={true}
        canReindex={true}
        migrations={[]}
        onUploadGroupChange={vi.fn()}
        onUpload={vi.fn()}
        onCreateGroup={vi.fn()}
        onShareGroup={vi.fn()}
        onDelete={onDelete}
        onStageReindex={vi.fn()}
        onCutoverReindex={vi.fn()}
        onRollbackReindex={vi.fn()}
        onBack={vi.fn()}
      />
    )

    await userEvent.click(screen.getByTitle("requirements.mdを削除"))
    const dialog = screen.getByRole("dialog", { name: "文書を削除しますか" })
    await userEvent.click(within(dialog).getByRole("button", { name: "削除" }))

    expect(onDelete).toHaveBeenCalledTimes(1)
    expect(within(dialog).getByRole("button", { name: "処理中" })).toBeDisabled()
    expect(within(dialog).getByRole("button", { name: "キャンセル" })).toBeDisabled()
    await userEvent.click(within(dialog).getByRole("button", { name: "処理中" }))
    expect(onDelete).toHaveBeenCalledTimes(1)

    deferred.resolve()
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "文書を削除しますか" })).not.toBeInTheDocument())
  })

  it("確認ダイアログは失敗時に閉じず、失敗ログを残す", async () => {
    const onDelete = vi.fn().mockResolvedValue({ ok: false, error: "delete failed" })

    render(
      <DocumentWorkspace
        documents={documents}
        documentGroups={documentGroups}
        uploadGroupId=""
        loading={false}
        canWrite={true}
        canDelete={true}
        canReindex={true}
        migrations={[]}
        onUploadGroupChange={vi.fn()}
        onUpload={vi.fn()}
        onCreateGroup={vi.fn()}
        onShareGroup={vi.fn()}
        onDelete={onDelete}
        onStageReindex={vi.fn()}
        onCutoverReindex={vi.fn()}
        onRollbackReindex={vi.fn()}
        onBack={vi.fn()}
      />
    )

    await userEvent.click(screen.getByTitle("requirements.mdを削除"))
    await userEvent.click(screen.getByRole("button", { name: "削除" }))

    expect(screen.getByRole("dialog", { name: "文書を削除しますか" })).toBeInTheDocument()
    expect(screen.getByRole("alert")).toHaveTextContent("delete failed")
    const recentOperations = screen.getByRole("list", { name: "最近の操作" })
    expect(within(recentOperations).getByText("文書削除")).toBeInTheDocument()
    expect(within(recentOperations).getByText("失敗")).toBeInTheDocument()
    expect(within(recentOperations).getByText(/delete failed/)).toBeInTheDocument()
  })

  it("確認ダイアログはEscape、focus trap、return focusを扱う", async () => {
    const user = userEvent.setup()

    render(
      <DocumentWorkspace
        documents={documents}
        documentGroups={documentGroups}
        uploadGroupId=""
        loading={false}
        canWrite={true}
        canDelete={true}
        canReindex={true}
        migrations={[]}
        onUploadGroupChange={vi.fn()}
        onUpload={vi.fn()}
        onCreateGroup={vi.fn()}
        onShareGroup={vi.fn()}
        onDelete={vi.fn()}
        onStageReindex={vi.fn()}
        onCutoverReindex={vi.fn()}
        onRollbackReindex={vi.fn()}
        onBack={vi.fn()}
      />
    )

    const deleteButton = screen.getByTitle("requirements.mdを削除")
    await user.click(deleteButton)
    const dialog = screen.getByRole("dialog", { name: "文書を削除しますか" })
    const cancelButton = within(dialog).getByRole("button", { name: "キャンセル" })
    const confirmButton = within(dialog).getByRole("button", { name: "削除" })

    expect(cancelButton).toHaveFocus()
    await user.tab({ shift: true })
    expect(confirmButton).toHaveFocus()
    await user.tab()
    expect(cancelButton).toHaveFocus()

    await user.keyboard("{Escape}")
    expect(screen.queryByRole("dialog", { name: "文書を削除しますか" })).not.toBeInTheDocument()
    expect(deleteButton).toHaveFocus()
  })

  it("操作データがない場合は最近の操作の空状態を表示する", () => {
    render(
      <DocumentWorkspace
        documents={[]}
        documentGroups={[]}
        uploadGroupId=""
        loading={false}
        canWrite={true}
        canDelete={true}
        canReindex={true}
        migrations={[]}
        onUploadGroupChange={vi.fn()}
        onUpload={vi.fn()}
        onCreateGroup={vi.fn()}
        onShareGroup={vi.fn()}
        onDelete={vi.fn()}
        onStageReindex={vi.fn()}
        onCutoverReindex={vi.fn()}
        onRollbackReindex={vi.fn()}
        onBack={vi.fn()}
      />
    )

    expect(screen.getByRole("list", { name: "最近の操作" })).toHaveTextContent("最近の操作はありません。")
  })

  it("フォルダ管理と保存先フォルダ選択を通知する", async () => {
    const onUploadGroupChange = vi.fn()
    const onCreateGroup = vi.fn().mockResolvedValue(undefined)
    const onShareGroup = vi.fn().mockResolvedValue(undefined)
    const groupedDocuments = [
      {
        ...documents[0]!,
        metadata: { groupIds: ["group-1"] }
      }
    ]

    render(
      <DocumentWorkspace
        documents={groupedDocuments}
        documentGroups={documentGroups}
        uploadGroupId=""
        loading={false}
        canWrite={true}
        canDelete={true}
        canReindex={false}
        migrations={[]}
        onUploadGroupChange={onUploadGroupChange}
        onUpload={vi.fn()}
        onCreateGroup={onCreateGroup}
        onShareGroup={onShareGroup}
        onDelete={vi.fn()}
        onStageReindex={vi.fn()}
        onCutoverReindex={vi.fn()}
        onRollbackReindex={vi.fn()}
        onBack={vi.fn()}
      />
    )

    expect(screen.getByRole("button", { name: /社内規定/ })).toBeInTheDocument()
    expect(screen.getByRole("heading", { name: "フォルダ情報 / 共有設定" })).toBeInTheDocument()

    await userEvent.selectOptions(screen.getByLabelText("保存先フォルダ"), "group-1")
    expect(onUploadGroupChange).toHaveBeenCalledWith("group-1")

    await userEvent.click(screen.getByRole("button", { name: /すべてのドキュメント/ }))
    expect(onUploadGroupChange).toHaveBeenCalledWith("")

    await userEvent.type(screen.getByLabelText("新規フォルダ名"), "個人メモ")
    await userEvent.click(screen.getByRole("button", { name: "新規フォルダ" }))
    expect(onCreateGroup).toHaveBeenCalledWith({ name: "個人メモ", visibility: "private" })

    await userEvent.selectOptions(screen.getByLabelText("共有フォルダ"), "group-1")
    await userEvent.clear(screen.getByLabelText("共有 Cognito group"))
    await userEvent.type(screen.getByLabelText("共有 Cognito group"), "HR, RAG_GROUP_MANAGER")
    expect(screen.getByText("追加: RAG_GROUP_MANAGER")).toBeInTheDocument()
    expect(screen.getByText("変更なし: HR")).toBeInTheDocument()
    await userEvent.click(screen.getByRole("button", { name: "共有更新" }))
    expect(onShareGroup).toHaveBeenCalledWith("group-1", {
      visibility: "shared",
      sharedGroups: ["HR", "RAG_GROUP_MANAGER"]
    })
  })

  it("設定込みでフォルダを作成し、作成後に保存先へ移動する", async () => {
    const onCreateGroup = vi.fn().mockResolvedValue({
      groupId: "group-new",
      name: "人事規程",
      visibility: "shared",
      ownerUserId: "user-1",
      sharedUserIds: [],
      sharedGroups: ["HR"],
      managerUserIds: ["manager-1"],
      createdAt: "2026-05-10T00:00:00.000Z",
      updatedAt: "2026-05-10T00:00:00.000Z"
    } satisfies DocumentGroup)
    const onUploadGroupChange = vi.fn()

    render(
      <DocumentWorkspace
        documents={documents}
        documentGroups={documentGroups}
        uploadGroupId=""
        loading={false}
        canWrite={true}
        canDelete={true}
        canReindex={true}
        migrations={[]}
        onUploadGroupChange={onUploadGroupChange}
        onUpload={vi.fn()}
        onCreateGroup={onCreateGroup}
        onShareGroup={vi.fn()}
        onDelete={vi.fn()}
        onStageReindex={vi.fn()}
        onCutoverReindex={vi.fn()}
        onRollbackReindex={vi.fn()}
        onBack={vi.fn()}
      />
    )

    await userEvent.type(screen.getByLabelText("新規フォルダ名"), "人事規程")
    await userEvent.type(screen.getByLabelText("説明"), "人事部門の就業規則")
    await userEvent.selectOptions(screen.getByLabelText("親フォルダ"), "group-1")
    await userEvent.selectOptions(screen.getByLabelText("公開範囲"), "shared")
    await userEvent.type(screen.getByLabelText("初期 shared groups"), "HR, RAG_GROUP_MANAGER")
    await userEvent.type(screen.getByLabelText("管理者 user IDs"), "manager-1, manager-2")

    expect(screen.getByText("公開範囲: 指定 group 共有")).toBeInTheDocument()
    expect(screen.getByText("親フォルダ: 社内規定")).toBeInTheDocument()
    expect(screen.getByText("共有先: HR, RAG_GROUP_MANAGER")).toBeInTheDocument()
    expect(screen.getByText("管理者: manager-1, manager-2")).toBeInTheDocument()
    expect(screen.getByText("作成後移動: する")).toBeInTheDocument()

    await userEvent.click(screen.getByRole("button", { name: "新規フォルダ" }))

    expect(onCreateGroup).toHaveBeenCalledWith({
      name: "人事規程",
      description: "人事部門の就業規則",
      parentGroupId: "group-1",
      visibility: "shared",
      sharedGroups: ["HR", "RAG_GROUP_MANAGER"],
      managerUserIds: ["manager-1", "manager-2"]
    })
    expect(onUploadGroupChange).toHaveBeenCalledWith("group-new")
  })

  it("新規フォルダ作成で実データ由来のshared group候補を選択してpayloadへ反映する", async () => {
    const onCreateGroup = vi.fn().mockResolvedValue(undefined)

    render(
      <DocumentWorkspace
        documents={documents}
        documentGroups={documentGroups}
        uploadGroupId=""
        loading={false}
        canWrite={true}
        canDelete={true}
        canReindex={true}
        migrations={[]}
        onUploadGroupChange={vi.fn()}
        onUpload={vi.fn()}
        onCreateGroup={onCreateGroup}
        onShareGroup={vi.fn()}
        onDelete={vi.fn()}
        onStageReindex={vi.fn()}
        onCutoverReindex={vi.fn()}
        onRollbackReindex={vi.fn()}
        onBack={vi.fn()}
      />
    )

    await userEvent.type(screen.getByLabelText("新規フォルダ名"), "共有資料")
    await userEvent.selectOptions(screen.getByLabelText("公開範囲"), "shared")

    const selector = screen.getByRole("group", { name: "初期 shared group 候補" })
    const hrOption = within(selector).getByRole("checkbox", { name: "HR" })
    expect(hrOption).not.toBeChecked()

    await userEvent.click(hrOption)
    expect(screen.getByLabelText("初期 shared groups")).toHaveValue("HR")
    expect(screen.getByText("共有先: HR")).toBeInTheDocument()

    await userEvent.type(screen.getByLabelText("初期 shared groups"), ", RAG_GROUP_MANAGER")
    expect(within(selector).getByRole("checkbox", { name: "RAG_GROUP_MANAGER" })).toBeChecked()

    await userEvent.click(hrOption)
    expect(screen.getByLabelText("初期 shared groups")).toHaveValue("RAG_GROUP_MANAGER")
    expect(screen.getByText("共有先: RAG_GROUP_MANAGER")).toBeInTheDocument()

    await userEvent.click(screen.getByRole("button", { name: "新規フォルダ" }))
    expect(onCreateGroup).toHaveBeenCalledWith({
      name: "共有資料",
      visibility: "shared",
      sharedGroups: ["RAG_GROUP_MANAGER"]
    })
  })

  it("新規フォルダ作成のshared group候補がない場合は架空候補を表示しない", () => {
    render(
      <DocumentWorkspace
        documents={documents}
        documentGroups={[{ ...documentGroups[0]!, sharedGroups: [] }]}
        uploadGroupId=""
        loading={false}
        canWrite={true}
        canDelete={true}
        canReindex={true}
        migrations={[]}
        onUploadGroupChange={vi.fn()}
        onUpload={vi.fn()}
        onCreateGroup={vi.fn()}
        onShareGroup={vi.fn()}
        onDelete={vi.fn()}
        onStageReindex={vi.fn()}
        onCutoverReindex={vi.fn()}
        onRollbackReindex={vi.fn()}
        onBack={vi.fn()}
      />
    )

    const selector = screen.getByRole("group", { name: "初期 shared group 候補" })
    expect(selector).toHaveTextContent("候補はありません。必要な group 名を入力してください。")
    expect(within(selector).queryByRole("checkbox", { name: "CHAT_USER" })).not.toBeInTheDocument()
    expect(within(selector).queryByRole("checkbox", { name: "RAG_GROUP_MANAGER" })).not.toBeInTheDocument()
  })

  it("フォルダ作成のshared groupsと管理者IDをvalidationする", async () => {
    const onCreateGroup = vi.fn().mockResolvedValue(undefined)

    render(
      <DocumentWorkspace
        documents={documents}
        documentGroups={documentGroups}
        uploadGroupId=""
        loading={false}
        canWrite={true}
        canDelete={true}
        canReindex={true}
        migrations={[]}
        onUploadGroupChange={vi.fn()}
        onUpload={vi.fn()}
        onCreateGroup={onCreateGroup}
        onShareGroup={vi.fn()}
        onDelete={vi.fn()}
        onStageReindex={vi.fn()}
        onCutoverReindex={vi.fn()}
        onRollbackReindex={vi.fn()}
        onBack={vi.fn()}
      />
    )

    await userEvent.type(screen.getByLabelText("新規フォルダ名"), "監査資料")
    await userEvent.selectOptions(screen.getByLabelText("公開範囲"), "shared")
    await userEvent.type(screen.getByLabelText("初期 shared groups"), "AUDIT,,AUDIT")
    await userEvent.type(screen.getByLabelText("管理者 user IDs"), "manager-1,,manager-1")

    expect(screen.getByText("shared groups に空の指定があります。余分なカンマを削除してください。")).toBeInTheDocument()
    expect(screen.getByText("重複している shared group: AUDIT")).toBeInTheDocument()
    expect(screen.getByText("管理者 user IDs に空の指定があります。余分なカンマを削除してください。")).toBeInTheDocument()
    expect(screen.getByText("重複している管理者 user ID: manager-1")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "新規フォルダ" })).toBeDisabled()
    expect(onCreateGroup).not.toHaveBeenCalled()
  })

  it("共有group入力の重複と空値をvalidationする", async () => {
    const onShareGroup = vi.fn().mockResolvedValue(undefined)

    render(
      <DocumentWorkspace
        documents={documents}
        documentGroups={documentGroups}
        uploadGroupId=""
        loading={false}
        canWrite={true}
        canDelete={true}
        canReindex={true}
        migrations={[]}
        onUploadGroupChange={vi.fn()}
        onUpload={vi.fn()}
        onCreateGroup={vi.fn()}
        onShareGroup={onShareGroup}
        onDelete={vi.fn()}
        onStageReindex={vi.fn()}
        onCutoverReindex={vi.fn()}
        onRollbackReindex={vi.fn()}
        onBack={vi.fn()}
      />
    )

    await userEvent.selectOptions(screen.getByLabelText("共有フォルダ"), "group-1")
    await userEvent.clear(screen.getByLabelText("共有 Cognito group"))
    await userEvent.type(screen.getByLabelText("共有 Cognito group"), "HR,,HR")

    expect(screen.getByText("空の group 指定があります。余分なカンマを削除してください。")).toBeInTheDocument()
    expect(screen.getByText("重複している group: HR")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "共有更新" })).toBeDisabled()
    expect(onShareGroup).not.toHaveBeenCalled()
  })

  it("実データ由来の共有group候補を選択して共有差分とpayloadに反映する", async () => {
    const onShareGroup = vi.fn().mockResolvedValue(undefined)

    render(
      <DocumentWorkspace
        documents={documents}
        documentGroups={documentGroups}
        uploadGroupId=""
        loading={false}
        canWrite={true}
        canDelete={true}
        canReindex={true}
        migrations={[]}
        onUploadGroupChange={vi.fn()}
        onUpload={vi.fn()}
        onCreateGroup={vi.fn()}
        onShareGroup={onShareGroup}
        onDelete={vi.fn()}
        onStageReindex={vi.fn()}
        onCutoverReindex={vi.fn()}
        onRollbackReindex={vi.fn()}
        onBack={vi.fn()}
      />
    )

    await userEvent.selectOptions(screen.getByLabelText("共有フォルダ"), "group-1")

    const selector = screen.getByRole("group", { name: "共有 group 候補" })
    const hrOption = within(selector).getByRole("checkbox", { name: "HR" })
    expect(screen.getByLabelText("共有 Cognito group")).toHaveValue("HR")
    expect(hrOption).toBeChecked()
    expect(screen.getByText("変更なし: HR")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "共有更新" })).toBeDisabled()

    await userEvent.type(screen.getByLabelText("共有 Cognito group"), ", RAG_GROUP_MANAGER")
    const ragOption = within(selector).getByRole("checkbox", { name: "RAG_GROUP_MANAGER" })
    expect(ragOption).toBeChecked()

    await userEvent.click(hrOption)
    expect(screen.getByLabelText("共有 Cognito group")).toHaveValue("RAG_GROUP_MANAGER")
    expect(screen.getByText("追加: RAG_GROUP_MANAGER")).toBeInTheDocument()
    expect(screen.getByText("削除: HR")).toBeInTheDocument()

    await userEvent.click(screen.getByRole("button", { name: "共有更新" }))
    expect(onShareGroup).toHaveBeenCalledWith("group-1", {
      visibility: "shared",
      sharedGroups: ["RAG_GROUP_MANAGER"]
    })
  })

  it("未変更の共有更新を抑止し、全解除には専用確認を要求する", async () => {
    const onShareGroup = vi.fn().mockResolvedValue(undefined)

    render(
      <DocumentWorkspace
        documents={documents}
        documentGroups={documentGroups}
        uploadGroupId=""
        loading={false}
        canWrite={true}
        canDelete={true}
        canReindex={true}
        migrations={[]}
        onUploadGroupChange={vi.fn()}
        onUpload={vi.fn()}
        onCreateGroup={vi.fn()}
        onShareGroup={onShareGroup}
        onDelete={vi.fn()}
        onStageReindex={vi.fn()}
        onCutoverReindex={vi.fn()}
        onRollbackReindex={vi.fn()}
        onBack={vi.fn()}
      />
    )

    await userEvent.selectOptions(screen.getByLabelText("共有フォルダ"), "group-1")

    const shareInput = screen.getByLabelText("共有 Cognito group")
    const submitButton = screen.getByRole("button", { name: "共有更新" })
    expect(shareInput).toHaveValue("HR")
    expect(submitButton).toBeDisabled()

    await userEvent.clear(shareInput)
    expect(screen.getByText("削除: HR")).toBeInTheDocument()
    expect(screen.getByLabelText("既存共有をすべて削除することを確認しました")).not.toBeChecked()
    expect(submitButton).toBeDisabled()

    await userEvent.click(submitButton)
    expect(onShareGroup).not.toHaveBeenCalled()

    await userEvent.click(screen.getByLabelText("既存共有をすべて削除することを確認しました"))
    await userEvent.click(submitButton)

    expect(onShareGroup).toHaveBeenCalledWith("group-1", {
      visibility: "private",
      sharedGroups: []
    })
  })

  it("共有group候補がない場合は架空候補を表示しない", () => {
    render(
      <DocumentWorkspace
        documents={documents}
        documentGroups={[{ ...documentGroups[0]!, sharedGroups: [] }]}
        uploadGroupId=""
        loading={false}
        canWrite={true}
        canDelete={true}
        canReindex={true}
        migrations={[]}
        onUploadGroupChange={vi.fn()}
        onUpload={vi.fn()}
        onCreateGroup={vi.fn()}
        onShareGroup={vi.fn()}
        onDelete={vi.fn()}
        onStageReindex={vi.fn()}
        onCutoverReindex={vi.fn()}
        onRollbackReindex={vi.fn()}
        onBack={vi.fn()}
      />
    )

    expect(screen.getByRole("group", { name: "共有 group 候補" })).toHaveTextContent("候補はありません。必要な group 名を入力してください。")
    expect(screen.queryByRole("checkbox", { name: "CHAT_USER" })).not.toBeInTheDocument()
    expect(screen.queryByRole("checkbox", { name: "RAG_GROUP_MANAGER" })).not.toBeInTheDocument()
  })

  it("実データのファイル種別を表示し、再インデックスを通知する", async () => {
    const onStageReindex = vi.fn().mockResolvedValue(undefined)

    render(
      <DocumentWorkspace
        documents={typedDocuments}
        {...documentGroupProps}
        loading={false}
        canWrite={true}
        canDelete={true}
        canReindex={true}
        migrations={[]}
        onUpload={vi.fn()}
        onDelete={vi.fn()}
        onStageReindex={onStageReindex}
        onCutoverReindex={vi.fn()}
        onRollbackReindex={vi.fn()}
        onBack={vi.fn()}
      />
    )

    expect(screen.getByRole("heading", { name: "すべてのドキュメント" })).toBeInTheDocument()
    expect(screen.getAllByText("TeX").length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText("PDF").length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText("Word").length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText("PowerPoint").length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText("CSV").length).toBeGreaterThanOrEqual(1)
    expect(screen.queryByText("メモリカード")).not.toBeInTheDocument()

    await userEvent.click(screen.getByTitle("inventory.csvの再インデックスをステージング"))
    await userEvent.click(screen.getByRole("button", { name: "ステージング" }))

    expect(onStageReindex).toHaveBeenCalledWith("doc-csv")
  })

  it("フォルダ検索でグループを絞り込み、検索結果なしを表示する", async () => {
    render(
      <DocumentWorkspace
        documents={documents}
        documentGroups={[documentGroups[0]!, organizationGroup]}
        uploadGroupId=""
        loading={false}
        canWrite={true}
        canDelete={true}
        canReindex={true}
        migrations={[]}
        onUploadGroupChange={vi.fn()}
        onUpload={vi.fn()}
        onCreateGroup={vi.fn()}
        onShareGroup={vi.fn()}
        onDelete={vi.fn()}
        onStageReindex={vi.fn()}
        onCutoverReindex={vi.fn()}
        onRollbackReindex={vi.fn()}
        onBack={vi.fn()}
      />
    )

    await userEvent.type(screen.getByLabelText("フォルダを検索"), "全社")

    expect(screen.getByRole("button", { name: /全社公開/ })).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: /社内規定/ })).not.toBeInTheDocument()

    await userEvent.clear(screen.getByLabelText("フォルダを検索"))
    await userEvent.type(screen.getByLabelText("フォルダを検索"), "not-found-folder")

    expect(screen.getByText("一致するフォルダはありません。")).toBeInTheDocument()
  })

  it("文書一覧を検索、絞り込み、並び替えできる", async () => {
    render(
      <DocumentWorkspace
        documents={[
          { ...typedDocuments[0]!, metadata: { groupIds: ["group-1"] } },
          { ...typedDocuments[1]!, lifecycleStatus: "staging" },
          { ...typedDocuments[2]!, metadata: { groupIds: ["group-1"] } }
        ]}
        documentGroups={documentGroups}
        uploadGroupId=""
        loading={false}
        canWrite={true}
        canDelete={true}
        canReindex={true}
        migrations={[]}
        onUploadGroupChange={vi.fn()}
        onUpload={vi.fn()}
        onCreateGroup={vi.fn()}
        onShareGroup={vi.fn()}
        onDelete={vi.fn()}
        onStageReindex={vi.fn()}
        onCutoverReindex={vi.fn()}
        onRollbackReindex={vi.fn()}
        onBack={vi.fn()}
      />
    )

    expect(screen.getByText("1-3 / 3 件を表示（フォルダ内 3 件 / 全体 3 件）")).toBeInTheDocument()
    const documentTable = screen.getByRole("table", { name: "登録文書" })

    await userEvent.type(screen.getByLabelText("ファイル名検索"), "security")
    expect(within(documentTable).getAllByText("security_policy.bin").length).toBeGreaterThanOrEqual(1)
    expect(within(documentTable).queryByText("requirements.tex")).not.toBeInTheDocument()
    expect(screen.getByText("1-1 / 1 件を表示（フォルダ内 3 件 / 全体 3 件）")).toBeInTheDocument()

    await userEvent.clear(screen.getByLabelText("ファイル名検索"))
    await userEvent.selectOptions(screen.getByLabelText("種別"), "Word")
    expect(within(documentTable).getAllByText("onboarding.docx").length).toBeGreaterThanOrEqual(1)
    expect(within(documentTable).queryByText("security_policy.bin")).not.toBeInTheDocument()

    await userEvent.selectOptions(screen.getByLabelText("種別"), "すべて")
    await userEvent.selectOptions(screen.getByLabelText("状態"), "staging")
    expect(within(documentTable).getAllByText("security_policy.bin").length).toBeGreaterThanOrEqual(1)
    expect(within(documentTable).queryByText("onboarding.docx")).not.toBeInTheDocument()

    await userEvent.selectOptions(screen.getByLabelText("状態"), "すべて")
    await userEvent.selectOptions(screen.getByLabelText("所属フォルダ"), "group-1")
    expect(within(documentTable).getAllByText("requirements.tex").length).toBeGreaterThanOrEqual(1)
    expect(within(documentTable).getAllByText("onboarding.docx").length).toBeGreaterThanOrEqual(1)
    expect(within(documentTable).queryByText("security_policy.bin")).not.toBeInTheDocument()

    await userEvent.selectOptions(screen.getByLabelText("所属フォルダ"), "未設定")
    expect(within(documentTable).getAllByText("security_policy.bin").length).toBeGreaterThanOrEqual(1)
    expect(within(documentTable).queryByText("requirements.tex")).not.toBeInTheDocument()

    await userEvent.selectOptions(screen.getByLabelText("所属フォルダ"), "すべて")
    await userEvent.type(screen.getByLabelText("ファイル名検索"), "not-found-document")
    expect(screen.getByText("条件に一致するドキュメントはありません。")).toBeInTheDocument()
  })

  it("URL由来のフォルダ、検索条件、文書詳細を初期状態に反映する", () => {
    render(
      <DocumentWorkspace
        documents={[{ ...documents[0]!, metadata: { groupIds: ["group-1"] } }]}
        documentGroups={documentGroups}
        uploadGroupId=""
        loading={false}
        canWrite={true}
        canDelete={true}
        canReindex={true}
        migrations={migrations}
        urlState={{
          folderId: "group-1",
          documentId: "doc-1",
          migrationId: "migration-1",
          query: "requirements",
          groupFilter: "group-1",
          sort: "fileNameAsc"
        }}
        onUploadGroupChange={vi.fn()}
        onUpload={vi.fn()}
        onCreateGroup={vi.fn()}
        onShareGroup={vi.fn()}
        onDelete={vi.fn()}
        onStageReindex={vi.fn()}
        onCutoverReindex={vi.fn()}
        onRollbackReindex={vi.fn()}
        onBack={vi.fn()}
      />
    )

    expect(screen.getByRole("heading", { name: "社内規定" })).toBeInTheDocument()
    expect(screen.getByLabelText("ファイル名検索")).toHaveValue("requirements")
    expect(screen.getByLabelText("所属フォルダ")).toHaveValue("group-1")
    expect(screen.getByLabelText("並び替え")).toHaveValue("fileNameAsc")
    expect(screen.getByRole("dialog", { name: "requirements.md" })).toBeInTheDocument()
    const migrationStrip = screen.getByLabelText("再インデックス移行一覧")
    expect(within(migrationStrip).getByText("doc-1 → doc-1-staged").closest("article")).toHaveAttribute("aria-current", "true")
  })

  it("文書管理状態の変更をURL同期コールバックへ通知する", async () => {
    const onUrlStateChange = vi.fn()

    render(
      <DocumentWorkspace
        documents={[{ ...documents[0]!, metadata: { groupIds: ["group-1"] } }]}
        documentGroups={documentGroups}
        uploadGroupId=""
        loading={false}
        canWrite={true}
        canDelete={true}
        canReindex={true}
        migrations={migrations}
        onUrlStateChange={onUrlStateChange}
        onUploadGroupChange={vi.fn()}
        onUpload={vi.fn()}
        onCreateGroup={vi.fn()}
        onShareGroup={vi.fn()}
        onDelete={vi.fn()}
        onStageReindex={vi.fn()}
        onCutoverReindex={vi.fn()}
        onRollbackReindex={vi.fn()}
        onBack={vi.fn()}
      />
    )

    await userEvent.click(screen.getByRole("button", { name: /社内規定/ }))
    await userEvent.type(screen.getByLabelText("ファイル名検索"), "requirements")
    await userEvent.click(screen.getByLabelText("requirements.mdの詳細を表示"))

    await waitFor(() => {
      expect(onUrlStateChange).toHaveBeenLastCalledWith(expect.objectContaining({
        folderId: "group-1",
        documentId: "doc-1",
        query: "requirements"
      }))
    })

    await userEvent.click(screen.getByRole("button", { name: "文書詳細を閉じる" }))
    await waitFor(() => {
      expect(onUrlStateChange).toHaveBeenLastCalledWith(expect.not.objectContaining({ documentId: "doc-1" }))
    })

    await userEvent.click(screen.getAllByRole("button", { name: "切替" })[0]!)
    await waitFor(() => {
      expect(onUrlStateChange).toHaveBeenLastCalledWith(expect.objectContaining({ migrationId: "migration-1" }))
    })
  })

  it("文書詳細drawerを開き、documentIdをコピーできる", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    const onAskDocument = vi.fn()
    vi.stubGlobal("navigator", { clipboard: { writeText } })

    render(
      <DocumentWorkspace
        documents={[
          {
            ...documents[0]!,
            mimeType: "text/markdown",
            metadata: {
              groupIds: ["group-1"],
              ingestRunId: "run-doc-1",
              embeddingModelId: "embed-model",
              memoryModelId: "memory-model",
              fileSizeBytes: 2048
            }
          }
        ]}
        documentGroups={documentGroups}
        uploadGroupId=""
        loading={false}
        canWrite={true}
        canDelete={true}
        canReindex={true}
        migrations={[]}
        onUploadGroupChange={vi.fn()}
        onUpload={vi.fn()}
        onCreateGroup={vi.fn()}
        onShareGroup={vi.fn()}
        onDelete={vi.fn()}
        onStageReindex={vi.fn()}
        onCutoverReindex={vi.fn()}
        onRollbackReindex={vi.fn()}
        onAskDocument={onAskDocument}
        onBack={vi.fn()}
      />
    )

    await userEvent.click(screen.getByLabelText("requirements.mdの詳細を表示"))

    expect(screen.getByRole("dialog", { name: "requirements.md" })).toBeInTheDocument()
    expect(screen.getByText("run-doc-1")).toBeInTheDocument()
    expect(screen.getByText("embed-model")).toBeInTheDocument()
    expect(screen.getByText("memory-model")).toBeInTheDocument()
    expect(screen.getByText("2.0 KB")).toBeInTheDocument()
    expect(screen.getAllByText("利用不可").length).toBeGreaterThanOrEqual(1)

    await userEvent.click(screen.getByRole("button", { name: "documentId コピー" }))
    expect(writeText).toHaveBeenCalledWith("doc-1")
    expect(screen.getByRole("button", { name: "コピー済み" })).toBeInTheDocument()

    await userEvent.click(screen.getByRole("button", { name: "この資料に質問する" }))
    expect(onAskDocument).toHaveBeenCalledWith(expect.objectContaining({ documentId: "doc-1", fileName: "requirements.md" }))

    vi.unstubAllGlobals()
  })

  it("詳細drawerから既存の確認ダイアログへ接続する", async () => {
    render(
      <DocumentWorkspace
        documents={documents}
        {...documentGroupProps}
        loading={false}
        canWrite={true}
        canDelete={true}
        canReindex={true}
        migrations={[]}
        onUpload={vi.fn()}
        onDelete={vi.fn()}
        onStageReindex={vi.fn()}
        onCutoverReindex={vi.fn()}
        onRollbackReindex={vi.fn()}
        onBack={vi.fn()}
      />
    )

    await userEvent.click(screen.getByLabelText("requirements.mdの詳細を表示"))
    await userEvent.click(screen.getByRole("button", { name: "再インデックス" }))
    expect(screen.getByRole("dialog", { name: "再インデックスをステージングしますか" })).toBeInTheDocument()
  })

  it("ヘッダーの追加と共有ボタンを既存操作へ接続する", async () => {
    const inputClick = vi.spyOn(HTMLInputElement.prototype, "click").mockImplementation(() => undefined)

    const onUploadGroupChange = vi.fn()
    const { rerender } = render(
      <DocumentWorkspace
        documents={documents}
        documentGroups={documentGroups}
        uploadGroupId=""
        loading={false}
        canWrite={true}
        canDelete={true}
        canReindex={true}
        migrations={[]}
        onUploadGroupChange={onUploadGroupChange}
        onUpload={vi.fn()}
        onCreateGroup={vi.fn()}
        onShareGroup={vi.fn()}
        onDelete={vi.fn()}
        onStageReindex={vi.fn()}
        onCutoverReindex={vi.fn()}
        onRollbackReindex={vi.fn()}
        onBack={vi.fn()}
      />
    )

    expect(screen.getByTitle("保存先を選択してアップロード")).toBeDisabled()

    await userEvent.click(screen.getByRole("button", { name: /社内規定/ }))
    expect(onUploadGroupChange).toHaveBeenCalledWith("group-1")
    rerender(
      <DocumentWorkspace
        documents={documents}
        documentGroups={documentGroups}
        uploadGroupId="group-1"
        loading={false}
        canWrite={true}
        canDelete={true}
        canReindex={true}
        migrations={[]}
        onUploadGroupChange={onUploadGroupChange}
        onUpload={vi.fn()}
        onCreateGroup={vi.fn()}
        onShareGroup={vi.fn()}
        onDelete={vi.fn()}
        onStageReindex={vi.fn()}
        onCutoverReindex={vi.fn()}
        onRollbackReindex={vi.fn()}
        onBack={vi.fn()}
      />
    )
    await userEvent.click(screen.getByRole("button", { name: /社内規定/ }))
    expect(screen.getByText((_, element) => element?.textContent === "保存先: 社内規定")).toBeInTheDocument()

    await userEvent.click(screen.getByTitle("このフォルダにアップロード"))
    expect(inputClick).toHaveBeenCalled()

    await userEvent.click(screen.getByTitle("共有設定を編集"))
    expect(screen.getByLabelText("共有フォルダ")).toHaveFocus()

    inputClick.mockRestore()
  })

  it("本番UI用の固定フォルダ、固定容量、架空共有先を表示しない", () => {
    render(
      <DocumentWorkspace
        documents={documents}
        {...documentGroupProps}
        loading={false}
        canWrite={true}
        canDelete={true}
        canReindex={true}
        migrations={[]}
        onUpload={vi.fn()}
        onDelete={vi.fn()}
        onStageReindex={vi.fn()}
        onCutoverReindex={vi.fn()}
        onRollbackReindex={vi.fn()}
        onBack={vi.fn()}
      />
    )

    expect(screen.queryByText("2025")).not.toBeInTheDocument()
    expect(screen.queryByText("ガイドライン")).not.toBeInTheDocument()
    expect(screen.queryByText("12.8 / 550 GB")).not.toBeInTheDocument()
    expect(screen.queryByText("管理部")).not.toBeInTheDocument()
    expect(screen.queryByText("登録済みドキュメント")).not.toBeInTheDocument()
    expect(screen.queryByText("メモリカード")).not.toBeInTheDocument()
    expect(screen.queryByText("名前を変更")).not.toBeInTheDocument()
    expect(screen.queryByText("移動")).not.toBeInTheDocument()
    expect(screen.queryByRole("progressbar")).not.toBeInTheDocument()
  })

  it("空のドキュメント状態と未共有グループを実データのまま表示する", async () => {
    render(
      <DocumentWorkspace
        documents={[]}
        documentGroups={[{ ...documentGroups[0]!, sharedGroups: [] }]}
        uploadGroupId=""
        loading={false}
        canWrite={true}
        canDelete={true}
        canReindex={true}
        migrations={[]}
        onUploadGroupChange={vi.fn()}
        onUpload={vi.fn()}
        onCreateGroup={vi.fn()}
        onShareGroup={vi.fn()}
        onDelete={vi.fn()}
        onStageReindex={vi.fn()}
        onCutoverReindex={vi.fn()}
        onRollbackReindex={vi.fn()}
        onBack={vi.fn()}
      />
    )

    await userEvent.click(screen.getByRole("button", { name: /社内規定/ }))

    expect(screen.getByText("登録済みドキュメントはありません。")).toBeInTheDocument()
    expect(screen.getByText("共有先は設定されていません。")).toBeInTheDocument()
    expect(screen.getByText("0 / 0 件を表示（全体 0 件）")).toBeInTheDocument()
  })

  it("組織公開とユーザー共有先、文字列のgroupId metadataを表示に反映する", async () => {
    const groupedDocuments = [
      {
        ...documents[0]!,
        metadata: { groupId: "group-org" }
      }
    ]

    render(
      <DocumentWorkspace
        documents={groupedDocuments}
        documentGroups={[organizationGroup]}
        uploadGroupId=""
        loading={false}
        canWrite={true}
        canDelete={true}
        canReindex={true}
        migrations={[]}
        onUploadGroupChange={vi.fn()}
        onUpload={vi.fn()}
        onCreateGroup={vi.fn()}
        onShareGroup={vi.fn()}
        onDelete={vi.fn()}
        onStageReindex={vi.fn()}
        onCutoverReindex={vi.fn()}
        onRollbackReindex={vi.fn()}
        onBack={vi.fn()}
      />
    )

    await userEvent.click(screen.getByRole("button", { name: /全社公開/ }))

    expect(screen.getAllByText("組織全体").length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText("公開範囲").length).toBeGreaterThanOrEqual(1)
    expect(screen.getByText("user-2")).toBeInTheDocument()
    expect(screen.getByText("User ID")).toBeInTheDocument()
    expect(screen.getAllByText("requirements.md").length).toBeGreaterThanOrEqual(1)
  })

  it("権限や入力が不足するフォーム操作では更新APIを呼ばない", async () => {
    const onUpload = vi.fn().mockResolvedValue(undefined)
    const onCreateGroup = vi.fn().mockResolvedValue(undefined)
    const onShareGroup = vi.fn().mockResolvedValue(undefined)

    render(
      <DocumentWorkspace
        documents={documents}
        {...documentGroupProps}
        loading={false}
        canWrite={false}
        canDelete={true}
        canReindex={true}
        migrations={[]}
        onUpload={onUpload}
        onCreateGroup={onCreateGroup}
        onShareGroup={onShareGroup}
        onDelete={vi.fn()}
        onStageReindex={vi.fn()}
        onCutoverReindex={vi.fn()}
        onRollbackReindex={vi.fn()}
        onBack={vi.fn()}
      />
    )

    await userEvent.click(screen.getByRole("button", { name: "共有更新" }))
    await userEvent.click(screen.getByRole("button", { name: "アップロード" }))
    await userEvent.click(screen.getByRole("button", { name: "新規フォルダ" }))

    expect(onUpload).not.toHaveBeenCalled()
    expect(onCreateGroup).not.toHaveBeenCalled()
    expect(onShareGroup).not.toHaveBeenCalled()
  })

  it("ファイルアップロードとmimeType由来の種別表示を処理する", async () => {
    const onUpload = vi.fn().mockResolvedValue(undefined)
    const file = new File(["hello"], "memo.txt", { type: "text/plain" })

    render(
      <DocumentWorkspace
        documents={[{ documentId: "doc-text", fileName: "memo.unknown", mimeType: "text/plain", chunkCount: 1, memoryCardCount: 0, createdAt: "2026-05-07T00:00:00.000Z" }]}
        documentGroups={documentGroups}
        uploadGroupId="group-1"
        onUploadGroupChange={vi.fn()}
        onCreateGroup={vi.fn()}
        onShareGroup={vi.fn()}
        loading={false}
        canWrite={true}
        canDelete={true}
        canReindex={true}
        migrations={[]}
        onUpload={onUpload}
        onDelete={vi.fn()}
        onStageReindex={vi.fn()}
        onCutoverReindex={vi.fn()}
        onRollbackReindex={vi.fn()}
        onBack={vi.fn()}
      />
    )

    expect(screen.getAllByText("Text").length).toBeGreaterThanOrEqual(1)

    await userEvent.upload(screen.getByLabelText("アップロードする文書を選択"), file)
    expect(screen.getByText("一時選択: memo.txt / 保存先: 社内規定")).toBeInTheDocument()

    await userEvent.click(screen.getByRole("button", { name: "アップロード" }))
    expect(onUpload).toHaveBeenCalledWith(file)
  })

  it("アップロード完了後に返却された文書の操作ボタンを表示する", async () => {
    const uploadedDocument: DocumentManifest = {
      documentId: "doc-uploaded",
      fileName: "memo.txt",
      mimeType: "text/plain",
      metadata: { groupIds: ["group-1"] },
      chunkCount: 2,
      memoryCardCount: 0,
      createdAt: "2026-05-09T00:00:00.000Z"
    }
    const onUpload = vi.fn().mockResolvedValue({ ok: true, document: uploadedDocument })
    const onUploadGroupChange = vi.fn()
    const onAskDocument = vi.fn()
    const file = new File(["hello"], "memo.txt", { type: "text/plain" })

    const baseProps = {
      documents: [uploadedDocument],
      documentGroups,
      uploadGroupId: "group-1",
      onUploadGroupChange,
      onCreateGroup: vi.fn(),
      onShareGroup: vi.fn(),
      loading: false,
      canWrite: true,
      canDelete: true,
      canReindex: true,
      migrations: [],
      onUpload,
      onDelete: vi.fn(),
      onStageReindex: vi.fn(),
      onCutoverReindex: vi.fn(),
      onRollbackReindex: vi.fn(),
      onAskDocument,
      onBack: vi.fn()
    }

    const { rerender } = render(<DocumentWorkspace {...baseProps} uploadState={null} />)

    await userEvent.upload(screen.getByLabelText("アップロードする文書を選択"), file)
    await userEvent.click(screen.getByRole("button", { name: "アップロード" }))

    rerender(
      <DocumentWorkspace
        {...baseProps}
        uploadState={{
          fileName: "memo.txt",
          groupId: "group-1",
          phase: "complete",
          runId: "run-uploaded"
        }}
      />
    )

    const completeActions = screen.getByLabelText("アップロード完了後の操作")
    await userEvent.click(within(completeActions).getByRole("button", { name: "詳細を開く" }))
    expect(screen.getByRole("dialog", { name: "memo.txt" })).toBeInTheDocument()

    await userEvent.click(within(completeActions).getByRole("button", { name: "この資料に質問する" }))
    expect(onAskDocument).toHaveBeenCalledWith(uploadedDocument)

    await userEvent.click(within(completeActions).getByRole("button", { name: "フォルダ内で表示" }))
    expect(onUploadGroupChange).toHaveBeenCalledWith("group-1")
    expect(screen.getByRole("heading", { name: "社内規定" })).toBeInTheDocument()
  })

  it("返却文書がない完了状態では文書操作ボタンを表示しない", () => {
    render(
      <DocumentWorkspace
        documents={documents}
        documentGroups={documentGroups}
        uploadGroupId="group-1"
        uploadState={{ fileName: "memo.txt", groupId: "group-1", phase: "complete" }}
        onUploadGroupChange={vi.fn()}
        onCreateGroup={vi.fn()}
        onShareGroup={vi.fn()}
        loading={false}
        canWrite={true}
        canDelete={true}
        canReindex={true}
        migrations={[]}
        onUpload={vi.fn()}
        onDelete={vi.fn()}
        onStageReindex={vi.fn()}
        onCutoverReindex={vi.fn()}
        onRollbackReindex={vi.fn()}
        onBack={vi.fn()}
      />
    )

    expect(screen.queryByRole("button", { name: "詳細を開く" })).not.toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "この資料に質問する" })).not.toBeInTheDocument()
    expect(screen.getByText("アップロードは完了しました。文書一覧の更新後に詳細を開けます。")).toBeInTheDocument()
  })

  it("アップロード進捗と対象行だけのloadingを表示する", () => {
    render(
      <DocumentWorkspace
        documents={[
          documents[0]!,
          { documentId: "doc-2", fileName: "policy.pdf", mimeType: "application/pdf", chunkCount: 3, memoryCardCount: 0, createdAt: "2026-05-08T00:00:00.000Z" }
        ]}
        documentGroups={documentGroups}
        uploadGroupId="group-1"
        operationState={{
          isUploading: true,
          creatingGroup: false,
          sharingGroupId: null,
          deletingDocumentId: "doc-2",
          stagingReindexDocumentId: null,
          cutoverMigrationId: null,
          rollbackMigrationId: null
        }}
        uploadState={{
          fileName: "policy.pdf",
          groupId: "group-1",
          phase: "embedding",
          runId: "run-123"
        }}
        loading={false}
        canWrite={true}
        canDelete={true}
        canReindex={true}
        migrations={[]}
        onUploadGroupChange={vi.fn()}
        onUpload={vi.fn()}
        onCreateGroup={vi.fn()}
        onShareGroup={vi.fn()}
        onDelete={vi.fn()}
        onStageReindex={vi.fn()}
        onCutoverReindex={vi.fn()}
        onRollbackReindex={vi.fn()}
        onBack={vi.fn()}
      />
    )

    expect(screen.getByText("ベクトル化中")).toBeInTheDocument()
    expect(screen.getAllByText("run ID: run-123").length).toBeGreaterThanOrEqual(1)
    expect(screen.getByTitle("policy.pdfを削除")).toBeDisabled()
    expect(screen.getByTitle("requirements.mdを削除")).not.toBeDisabled()
  })
})
