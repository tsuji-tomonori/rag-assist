import { render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"
import type { DocumentGroup, ReindexMigration } from "../types.js"
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
        migrations={[]}
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

    await userEvent.type(screen.getByLabelText("新規フォルダ"), "個人メモ")
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
    await userEvent.type(screen.getByLabelText("共有 Cognito group"), "HR,,HR")

    expect(screen.getByText("空の group 指定があります。余分なカンマを削除してください。")).toBeInTheDocument()
    expect(screen.getByText("重複している group: HR")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "共有更新" })).toBeDisabled()
    expect(onShareGroup).not.toHaveBeenCalled()
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

    expect(screen.getByText("3 / 3 件を表示（全体 3 件）")).toBeInTheDocument()
    const documentTable = screen.getByRole("table", { name: "登録文書" })

    await userEvent.type(screen.getByLabelText("ファイル名検索"), "security")
    expect(within(documentTable).getAllByText("security_policy.bin").length).toBeGreaterThanOrEqual(1)
    expect(within(documentTable).queryByText("requirements.tex")).not.toBeInTheDocument()
    expect(screen.getByText("1 / 3 件を表示（全体 3 件）")).toBeInTheDocument()

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

  it("文書詳細drawerを開き、documentIdをコピーできる", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
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

    expect(screen.getByText("組織全体")).toBeInTheDocument()
    expect(screen.getByText("公開範囲")).toBeInTheDocument()
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
    expect(screen.getByText("run ID: run-123")).toBeInTheDocument()
    expect(screen.getByTitle("policy.pdfを削除")).toBeDisabled()
    expect(screen.getByTitle("requirements.mdを削除")).not.toBeDisabled()
  })
})
