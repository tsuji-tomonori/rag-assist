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

function canonicalGroupFields(
  name: string,
  options: { ownerUserId?: string; parentCanonicalPath?: string; parentGroupId?: string } = {}
): Pick<DocumentGroup, "schemaVersion" | "itemType" | "tenantId" | "adminPrincipalType" | "adminPrincipalId" | "normalizedName" | "canonicalPath" | "normalizedCanonicalPath" | "adminPathPk" | "parentPathPk"> {
  const ownerUserId = options.ownerUserId ?? "user-1"
  const normalizedName = name.normalize("NFKC").toLocaleLowerCase("ja-JP")
  const canonicalPath = options.parentCanonicalPath ? `${options.parentCanonicalPath}/${name}` : `/${name}`
  const normalizedCanonicalPath = options.parentCanonicalPath ? `${options.parentCanonicalPath.normalize("NFKC").toLocaleLowerCase("ja-JP")}/${normalizedName}` : `/${normalizedName}`
  const adminPathPk = `default#user#${ownerUserId}`
  return {
    schemaVersion: 2,
    itemType: "documentGroup",
    tenantId: "default",
    adminPrincipalType: "user",
    adminPrincipalId: ownerUserId,
    normalizedName,
    canonicalPath,
    normalizedCanonicalPath,
    adminPathPk,
    parentPathPk: `${adminPathPk}#${options.parentGroupId ?? "ROOT"}`
  }
}

const documentGroups: DocumentGroup[] = [
  {
    groupId: "group-1",
    name: "社内規定",
    ...canonicalGroupFields("社内規定"),
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
  ...canonicalGroupFields("全社公開"),
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

  it("右側カラムを表示せず、フォルダ操作はモーダルで開く", async () => {
    const { container } = render(
      <DocumentWorkspace
        documents={[{ ...documents[0]!, metadata: { groupIds: ["group-1"] } }]}
        documentGroups={documentGroups}
        uploadGroupId="group-1"
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

    expect(container.querySelector(".document-detail-panel")).toBeNull()
    expect(screen.queryByRole("heading", { name: "フォルダ情報 / 共有設定" })).not.toBeInTheDocument()

    await userEvent.click(screen.getByRole("button", { name: "フォルダ情報" }))
    expect(screen.getByRole("dialog", { name: "フォルダ情報" })).toBeInTheDocument()
    expect(screen.getByText("ファイル数")).toBeInTheDocument()
    await userEvent.click(screen.getByRole("button", { name: "フォルダ情報を閉じる" }))

    await userEvent.click(screen.getByRole("button", { name: "フォルダ共有" }))
    expect(screen.getByRole("dialog", { name: "フォルダ共有" })).toBeInTheDocument()
    await userEvent.click(screen.getByRole("button", { name: "フォルダ共有を閉じる" }))

    await userEvent.click(screen.getByRole("button", { name: "フォルダ名変更" }))
    expect(screen.getByRole("dialog", { name: "フォルダ名変更" })).toBeInTheDocument()
  })

  it("ドキュメント操作列からファイル共有と移動モーダルを開く", async () => {
    const onLoadDocumentShare = vi.fn().mockResolvedValue({
      documentId: "doc-1",
      inheritedFolderGrants: [{ folderId: "group-1", permissionLevel: "readOnly" }],
      directDocumentGrants: [{
        documentShareGrantId: "grant-1",
        tenantId: "default",
        documentId: "doc-1",
        principalType: "user",
        principalId: "user-old",
        permissionLevel: "readOnly",
        createdBy: "user-a",
        reason: "old",
        createdAt: "2026-05-01T00:00:00.000Z",
        updatedAt: "2026-05-01T00:00:00.000Z"
      }],
      currentUserEffectivePermission: "full"
    })
    const onShareDocument = vi.fn().mockResolvedValue({ ok: true })
    const onMoveDocument = vi.fn().mockResolvedValue({ ok: true })

    render(
      <DocumentWorkspace
        documents={[{ ...documents[0]!, metadata: { groupIds: ["group-1"] }, updatedAt: "2026-05-01T00:00:00.000Z" }]}
        documentGroups={documentGroups}
        uploadGroupId="group-1"
        loading={false}
        canWrite={true}
        canDelete={true}
        canReindex={true}
        migrations={[]}
        onUploadGroupChange={vi.fn()}
        onUpload={vi.fn()}
        onCreateGroup={vi.fn()}
        onShareGroup={vi.fn()}
        onLoadDocumentShare={onLoadDocumentShare}
        onShareDocument={onShareDocument}
        onMoveDocument={onMoveDocument}
        onDelete={vi.fn()}
        onStageReindex={vi.fn()}
        onCutoverReindex={vi.fn()}
        onRollbackReindex={vi.fn()}
        onBack={vi.fn()}
      />
    )

    await userEvent.click(screen.getByRole("button", { name: "requirements.mdを共有" }))
    expect(onLoadDocumentShare).toHaveBeenCalledWith("doc-1")
    const shareDialog = await screen.findByRole("dialog", { name: "ファイル共有" })
    expect(within(shareDialog).getByText("ファイル名: requirements.md")).toBeInTheDocument()
    expect(within(shareDialog).getByText("継承: group-1 readOnly")).toBeInTheDocument()
    expect(within(shareDialog).getByText(/直接: user:user-old readOnly/)).toBeInTheDocument()
    expect(within(shareDialog).getByText("継承: group-1 readOnly").closest("span")?.querySelector("button")).toBeNull()
    await userEvent.click(within(shareDialog).getByRole("button", { name: "削除" }))
    expect(within(shareDialog).queryByText(/user-old/)).not.toBeInTheDocument()
    await userEvent.type(within(shareDialog).getByLabelText("共有先ID"), "user-b")
    await userEvent.type(within(shareDialog).getByLabelText("理由"), "確認依頼")
    await userEvent.click(within(shareDialog).getByRole("button", { name: "保存" }))
    expect(onShareDocument).toHaveBeenCalledWith("doc-1", {
      grants: [{ principalType: "user", principalId: "user-b", permissionLevel: "readOnly" }],
      reason: "確認依頼"
    })

    await userEvent.click(screen.getByRole("button", { name: "requirements.mdを移動" }))
    const moveDialog = screen.getByRole("dialog", { name: "ファイル移動" })
    await userEvent.selectOptions(within(moveDialog).getByLabelText("移動先フォルダ"), "group-1")
    await userEvent.type(within(moveDialog).getByLabelText("理由"), "整理のため")
    await userEvent.click(within(moveDialog).getByRole("button", { name: "移動" }))
    expect(onMoveDocument).toHaveBeenCalledWith("doc-1", {
      destinationFolderId: "group-1",
      reason: "整理のため",
      expectedUpdatedAt: "2026-05-01T00:00:00.000Z"
    })
  })

  it("文書行の操作可否は backend capabilities を優先する", () => {
    render(
      <DocumentWorkspace
        documents={[
          { documentId: "doc-readonly", fileName: "readonly.md", chunkCount: 1, memoryCardCount: 0, createdAt: "2026-05-01T00:00:00.000Z", currentUserEffectivePermission: "readOnly", capabilities: { canRead: true, canShare: false, canMove: false, canDelete: false, canReindex: false } },
          { documentId: "doc-full", fileName: "full.md", chunkCount: 1, memoryCardCount: 0, createdAt: "2026-05-02T00:00:00.000Z", currentUserEffectivePermission: "full", capabilities: { canRead: true, canShare: true, canMove: true, canDelete: true, canReindex: true } }
        ]}
        documentGroups={documentGroups}
        uploadGroupId="group-1"
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

    expect(screen.queryByRole("button", { name: "readonly.mdを共有" })).not.toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "readonly.mdを移動" })).not.toBeInTheDocument()
    expect(screen.getByRole("button", { name: "readonly.mdを削除" })).toBeDisabled()
    expect(screen.getByRole("button", { name: "full.mdを共有" })).toBeEnabled()
    expect(screen.getByRole("button", { name: "full.mdを移動" })).toBeEnabled()
    expect(screen.getByRole("button", { name: "full.mdを削除" })).toBeEnabled()
  })

  it("readOnly 選択フォルダでは global write 権限があってもフォルダ操作を無効化する", () => {
    const readOnlyGroup: DocumentGroup = {
      ...documentGroups[0]!,
      groupId: "group-readonly",
      name: "閲覧のみ",
      ...canonicalGroupFields("閲覧のみ"),
      effectivePermission: "readOnly"
    }

    render(
      <DocumentWorkspace
        documents={[{ ...documents[0]!, metadata: { groupIds: [readOnlyGroup.groupId] } }]}
        documentGroups={[readOnlyGroup]}
        uploadGroupId={readOnlyGroup.groupId}
        loading={false}
        canWrite={true}
        canDelete={true}
        canReindex={true}
        migrations={[]}
        urlState={{ folderId: readOnlyGroup.groupId }}
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

    expect(screen.queryByRole("button", { name: "フォルダ作成" })).not.toBeInTheDocument()
    expect(screen.getByRole("button", { name: "フォルダ共有" })).toBeDisabled()
    expect(screen.getByRole("button", { name: "フォルダ名変更" })).toBeDisabled()
    expect(screen.getByRole("button", { name: "フォルダ移動" })).toBeDisabled()
    expect(screen.getByRole("button", { name: "アップロード" })).toBeDisabled()
  })

  it("フォルダ共有保存可否はモーダル内の共有対象フォルダ権限で判定する", async () => {
    const fullGroup: DocumentGroup = {
      ...documentGroups[0]!,
      groupId: "group-full",
      name: "編集可能",
      ...canonicalGroupFields("編集可能"),
      sharedGroups: ["SALES"],
      effectivePermission: "full"
    }
    const readOnlyGroup: DocumentGroup = {
      ...documentGroups[0]!,
      groupId: "group-readonly",
      name: "閲覧のみ",
      ...canonicalGroupFields("閲覧のみ"),
      sharedGroups: ["HR"],
      effectivePermission: "readOnly"
    }
    const onShareGroup = vi.fn().mockResolvedValue({ ok: true })

    render(
      <DocumentWorkspace
        documents={documents}
        documentGroups={[fullGroup, readOnlyGroup]}
        uploadGroupId={fullGroup.groupId}
        loading={false}
        canWrite={true}
        canDelete={true}
        canReindex={true}
        migrations={[]}
        urlState={{ folderId: fullGroup.groupId }}
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

    await userEvent.click(screen.getByRole("button", { name: "フォルダ共有" }))
    const dialog = screen.getByRole("dialog", { name: "フォルダ共有" })
    const targetSelect = within(dialog).getByLabelText("共有フォルダ")
    const sharedGroupsInput = within(dialog).getByLabelText("共有 group")
    const saveButton = within(dialog).getByRole("button", { name: "保存" })

    await userEvent.selectOptions(targetSelect, readOnlyGroup.groupId)
    await userEvent.clear(sharedGroupsInput)
    await userEvent.type(sharedGroupsInput, "HR, SALES")
    expect(saveButton).toBeDisabled()

    await userEvent.selectOptions(targetSelect, fullGroup.groupId)
    await userEvent.clear(sharedGroupsInput)
    await userEvent.type(sharedGroupsInput, "SALES, FINANCE")
    expect(saveButton).toBeEnabled()
    await userEvent.click(saveButton)
    expect(onShareGroup).toHaveBeenCalledWith(fullGroup.groupId, {
      visibility: "shared",
      sharedGroups: ["SALES", "FINANCE"]
    })
  })

  it("文書移動モーダルは移動先の同名ファイル衝突を事前に表示する", async () => {
    render(
      <DocumentWorkspace
        documents={[
          { documentId: "doc-1", fileName: "policy.pdf", chunkCount: 1, memoryCardCount: 0, createdAt: "2026-05-02T00:00:00.000Z", metadata: { groupIds: ["group-1"] }, currentUserEffectivePermission: "full", capabilities: { canRead: true, canShare: true, canMove: true, canDelete: true, canReindex: true } },
          { documentId: "doc-2", fileName: "policy.pdf", chunkCount: 1, memoryCardCount: 0, createdAt: "2026-05-01T00:00:00.000Z", metadata: { groupIds: ["group-2"] }, currentUserEffectivePermission: "readOnly", capabilities: { canRead: true, canShare: false, canMove: false, canDelete: false, canReindex: false } }
        ]}
        documentGroups={[...documentGroups, { ...documentGroups[0]!, groupId: "group-2", name: "移動先", canonicalPath: "/移動先", normalizedCanonicalPath: "/移動先" }]}
        uploadGroupId="group-1"
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

    await userEvent.click(screen.getByRole("button", { name: "policy.pdfを移動" }))
    const dialog = screen.getByRole("dialog", { name: "ファイル移動" })
    await userEvent.selectOptions(within(dialog).getByLabelText("移動先フォルダ"), "group-2")
    await userEvent.type(within(dialog).getByLabelText("理由"), "整理")
    expect(within(dialog).getByRole("alert")).toHaveTextContent("同名ファイル")
    expect(within(dialog).getByRole("button", { name: "移動" })).toBeDisabled()
    await userEvent.clear(within(dialog).getByLabelText("移動後の表示名"))
    await userEvent.type(within(dialog).getByLabelText("移動後の表示名"), "policy-renamed.pdf")
    expect(within(dialog).getByRole("button", { name: "移動" })).toBeEnabled()
  })

  it("API 由来の ParsedDocument preview と抽出品質を詳細に表示する", async () => {
    const parsedDocument: DocumentManifest = {
      documentId: "doc-preview",
      fileName: "preview.pdf",
      mimeType: "application/pdf",
      chunkCount: 4,
      memoryCardCount: 1,
      createdAt: "2026-05-07T00:00:00.000Z",
      fileProfile: "mixed",
      parsedDocument: {
        schemaVersion: 2,
        text: "第1章 本文の抽出結果です。表と注記を含みます。",
        sourceExtractorVersion: "textract-v2",
        pages: [{ pageNumber: 1 }],
        blocks: [{ id: "block-1", kind: "text" }],
        tables: [{ id: "table-1" }],
        figures: []
      },
      extractionWarnings: [
        { code: "low_confidence", message: "2ページ目のOCR信頼度が低いです", severity: "warning", page: 2, confidence: 0.61 }
      ],
      extractionCounters: { pageCount: 2, tableCount: 1 },
      qualityProfile: {
        extractionQualityStatus: "low",
        ragEligibility: "eligible_with_warning",
        confidence: 0.78,
        flags: ["low_extraction_confidence"]
      }
    }

    render(
      <DocumentWorkspace
        documents={[parsedDocument]}
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

    await userEvent.click(screen.getByRole("row", { name: "preview.pdfの詳細を表示" }))

    const drawer = screen.getByRole("dialog", { name: "preview.pdf" })
    expect(within(drawer).getByText("抽出品質")).toBeInTheDocument()
    expect(within(drawer).getByText(/extraction: low/)).toBeInTheDocument()
    expect(within(drawer).getByText(/RAG: eligible_with_warning/)).toBeInTheDocument()
    expect(within(drawer).getByText(/flags: low_extraction_confidence/)).toBeInTheDocument()
    expect(within(drawer).getByText(/warning: low_confidence - 2ページ目のOCR信頼度が低いです/)).toBeInTheDocument()
    expect(within(drawer).getByText(/pageCount: 2/)).toBeInTheDocument()
    expect(within(drawer).getByText(/tableCount: 1/)).toBeInTheDocument()
    expect(within(drawer).getByText(/schemaVersion: 2 \/ extractor: textract-v2 \/ fileProfile: mixed/)).toBeInTheDocument()
    expect(within(drawer).getByText(/pages: 1 \/ blocks: 1 \/ tables: 1 \/ figures: 0/)).toBeInTheDocument()
    expect(within(drawer).getByText("第1章 本文の抽出結果です。表と注記を含みます。")).toBeInTheDocument()
  })

  it("preview API フィールドがない文書では架空の抽出内容を表示しない", async () => {
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

    await userEvent.click(screen.getByRole("row", { name: "requirements.mdの詳細を表示" }))

    const drawer = screen.getByRole("dialog", { name: "requirements.md" })
    expect(within(drawer).getByText("ParsedDocument summary")).toBeInTheDocument()
    expect(within(drawer).getAllByText("利用不可").length).toBeGreaterThanOrEqual(4)
    expect(within(drawer).queryByText(/pageCount:/)).not.toBeInTheDocument()
    expect(within(drawer).queryByText(/tableCount:/)).not.toBeInTheDocument()
    expect(within(drawer).queryByText(/schemaVersion:/)).not.toBeInTheDocument()
    expect(within(drawer).queryByText(/low_extraction_confidence/)).not.toBeInTheDocument()
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



  it("親子フォルダを階層順に表示し、パスを操作名に含める", () => {
    const childGroup: DocumentGroup = {
      groupId: "group-child",
      name: "人事",
      ...canonicalGroupFields("人事", { parentCanonicalPath: "/社内規定", parentGroupId: "group-1" }),
      parentGroupId: "group-1",
      ancestorGroupIds: ["group-1"],
      visibility: "private",
      ownerUserId: "user-1",
      sharedUserIds: [],
      sharedGroups: [],
      managerUserIds: ["user-1"],
      createdAt: "2026-05-02T00:00:00.000Z",
      updatedAt: "2026-05-02T00:00:00.000Z"
    }

    render(
      <DocumentWorkspace
        documents={[{ ...documents[0]!, metadata: { groupIds: ["group-child"] } }]}
        documentGroups={[...documentGroups, childGroup]}
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

    const parent = screen.getByRole("button", { name: /ドキュメントグループ\/社内規定 0件/ })
    const child = screen.getByRole("button", { name: /ドキュメントグループ\/社内規定\/人事 1件/ })
    expect(parent.compareDocumentPosition(child) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(child).toHaveAttribute("title", "/ ドキュメントグループ/社内規定/人事")
    expect(child).toHaveStyle({ paddingLeft: "52px" })
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






  it("削除と再インデックス権限がない場合は操作handlerを呼ばない", async () => {
    const onDelete = vi.fn()
    const onStageReindex = vi.fn()

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
        onCreateGroup={vi.fn()}
        onShareGroup={vi.fn()}
        onDelete={onDelete}
        onStageReindex={onStageReindex}
        onCutoverReindex={vi.fn()}
        onRollbackReindex={vi.fn()}
        onBack={vi.fn()}
      />
    )

    const deleteButton = screen.getByTitle("requirements.mdを削除")
    const reindexButton = screen.getByTitle("requirements.mdの再インデックスをステージング")
    expect(deleteButton).toBeDisabled()
    expect(reindexButton).toBeDisabled()

    await userEvent.click(deleteButton)
    await userEvent.click(reindexButton)

    expect(onDelete).not.toHaveBeenCalled()
    expect(onStageReindex).not.toHaveBeenCalled()
  })



  it("すべてのドキュメントでは文書ごとの所属フォルダ権限で削除と再インデックスを無効化する", async () => {
    const onDelete = vi.fn()
    const onStageReindex = vi.fn()
    const fullGroup: DocumentGroup = {
      ...documentGroups[0]!,
      groupId: "group-full",
      name: "full folder",
      ...canonicalGroupFields("full folder"),
      effectivePermission: "full"
    }
    const readOnlyGroup: DocumentGroup = {
      ...documentGroups[0]!,
      groupId: "group-readonly",
      name: "readonly folder",
      ...canonicalGroupFields("readonly folder"),
      effectivePermission: "readOnly",
      policySource: "inherited",
      inheritedFromFolderId: "group-parent"
    }

    render(
      <DocumentWorkspace
        documents={[
          { documentId: "doc-full", fileName: "full.md", chunkCount: 1, memoryCardCount: 0, createdAt: "2026-05-01T00:00:00.000Z", metadata: { groupIds: [fullGroup.groupId] } },
          { documentId: "doc-readonly", fileName: "readonly.md", chunkCount: 1, memoryCardCount: 0, createdAt: "2026-05-02T00:00:00.000Z", metadata: { groupIds: [readOnlyGroup.groupId] } }
        ]}
        documentGroups={[fullGroup, readOnlyGroup]}
        uploadGroupId={fullGroup.groupId}
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
        onStageReindex={onStageReindex}
        onCutoverReindex={vi.fn()}
        onRollbackReindex={vi.fn()}
        onBack={vi.fn()}
      />
    )

    expect(screen.getByTitle("full.mdを削除")).toBeEnabled()
    expect(screen.getByTitle("full.mdの再インデックスをステージング")).toBeEnabled()
    expect(screen.getByTitle("readonly.mdを削除")).toBeDisabled()
    expect(screen.getByTitle("readonly.mdの再インデックスをステージング")).toBeDisabled()

    await userEvent.click(screen.getByTitle("readonly.mdを削除"))
    await userEvent.click(screen.getByTitle("readonly.mdの再インデックスをステージング"))
    expect(onDelete).not.toHaveBeenCalled()
    expect(onStageReindex).not.toHaveBeenCalled()
  })









})
