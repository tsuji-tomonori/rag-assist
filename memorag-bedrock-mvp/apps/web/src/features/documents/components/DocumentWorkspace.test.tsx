import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"
import type { DocumentGroup, ReindexMigration } from "../types.js"
import { DocumentWorkspace } from "./DocumentWorkspace.js"

const documents = [
  { documentId: "doc-1", fileName: "requirements.md", chunkCount: 2, memoryCardCount: 1, createdAt: "2026-05-01T00:00:00.000Z" }
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

    expect(screen.getByText("requirements.md")).toBeInTheDocument()

    await userEvent.click(screen.getByTitle("requirements.mdを削除"))

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
    await userEvent.click(screen.getAllByRole("button", { name: "切替" })[0]!)
    await userEvent.click(screen.getAllByRole("button", { name: "戻す" })[1]!)

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

    expect(screen.getAllByRole("cell", { name: "社内規定" }).length).toBeGreaterThanOrEqual(2)

    await userEvent.selectOptions(screen.getByLabelText("保存先フォルダ"), "group-1")
    expect(onUploadGroupChange).toHaveBeenCalledWith("group-1")

    await userEvent.type(screen.getByLabelText("新規フォルダ"), "個人メモ")
    await userEvent.click(screen.getByRole("button", { name: "作成" }))
    expect(onCreateGroup).toHaveBeenCalledWith({ name: "個人メモ", visibility: "private" })

    await userEvent.selectOptions(screen.getByLabelText("共有フォルダ"), "group-1")
    await userEvent.clear(screen.getByLabelText("共有 Cognito group"))
    await userEvent.type(screen.getByLabelText("共有 Cognito group"), "HR, RAG_GROUP_MANAGER")
    await userEvent.click(screen.getByRole("button", { name: "共有更新" }))
    expect(onShareGroup).toHaveBeenCalledWith("group-1", {
      visibility: "shared",
      sharedGroups: ["HR", "RAG_GROUP_MANAGER"]
    })
  })
})
