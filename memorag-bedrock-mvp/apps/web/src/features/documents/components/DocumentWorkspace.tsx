import { type FormEvent, useMemo, useRef, useState } from "react"
import { Icon } from "../../../shared/components/Icon.js"
import { LoadingStatus } from "../../../shared/components/LoadingSpinner.js"
import type { DocumentOperationState, DocumentUploadState } from "../hooks/useDocuments.js"
import type { DocumentGroup, DocumentManifest, ReindexMigration } from "../types.js"
import { DocumentConfirmDialog } from "./workspace/DocumentConfirmDialog.js"
import { DocumentDetailPanel } from "./workspace/DocumentDetailPanel.js"
import { DocumentFilePanel } from "./workspace/DocumentFilePanel.js"
import { DocumentFolderTree } from "./workspace/DocumentFolderTree.js"
import {
  countDocumentsForGroup,
  documentGroupIds,
  emptyOperationState,
  sharedEntries,
  type ConfirmAction,
  type WorkspaceFolder
} from "./workspace/documentWorkspaceUtils.js"

export function DocumentWorkspace({
  documents,
  documentGroups = [],
  loading,
  canWrite,
  canDelete,
  canReindex,
  uploadGroupId = "",
  operationState = emptyOperationState,
  uploadState = null,
  migrations,
  onUploadGroupChange,
  onUpload,
  onCreateGroup,
  onShareGroup,
  onDelete,
  onStageReindex,
  onCutoverReindex,
  onRollbackReindex,
  onBack
}: {
  documents: DocumentManifest[]
  documentGroups?: DocumentGroup[]
  loading: boolean
  canWrite: boolean
  canDelete: boolean
  canReindex: boolean
  uploadGroupId?: string
  operationState?: DocumentOperationState
  uploadState?: DocumentUploadState
  migrations: ReindexMigration[]
  onUploadGroupChange: (groupId: string) => void
  onUpload: (file: File) => Promise<void>
  onCreateGroup: (input: { name: string; visibility: "private" | "shared" | "org" }) => Promise<void>
  onShareGroup: (groupId: string, input: { visibility?: "private" | "shared" | "org"; sharedGroups?: string[]; sharedUserIds?: string[] }) => Promise<void>
  onDelete: (documentId: string) => Promise<void>
  onStageReindex: (documentId: string) => Promise<void>
  onCutoverReindex: (migrationId: string) => Promise<void>
  onRollbackReindex: (migrationId: string) => Promise<void>
  onBack: () => void
}) {
  const [uploadFile, setUploadFile] = useState<File | null>(null)
  const [groupName, setGroupName] = useState("")
  const [shareGroupId, setShareGroupId] = useState("")
  const [shareGroups, setShareGroups] = useState("")
  const [selectedFolderId, setSelectedFolderId] = useState("all")
  const [folderSearch, setFolderSearch] = useState("")
  const [confirmAction, setConfirmAction] = useState<ConfirmAction | null>(null)
  const uploadInputRef = useRef<HTMLInputElement | null>(null)
  const shareSelectRef = useRef<HTMLSelectElement | null>(null)

  const folders = useMemo<WorkspaceFolder[]>(() => {
    return documentGroups.map((group) => ({
      id: group.groupId,
      name: group.name,
      path: `/ ドキュメントグループ / ${group.name}`,
      count: countDocumentsForGroup(documents, group.groupId),
      group
    }))
  }, [documentGroups, documents])

  const allDocumentsFolder: WorkspaceFolder = { id: "all", name: "すべてのドキュメント", path: "/ すべてのドキュメント", count: documents.length }
  const normalizedFolderSearch = folderSearch.trim().toLowerCase()
  const filteredFolders = normalizedFolderSearch
    ? folders.filter((folder) => `${folder.name} ${folder.path}`.toLowerCase().includes(normalizedFolderSearch))
    : folders
  const selectedFolder = selectedFolderId === "all" ? allDocumentsFolder : folders.find((folder) => folder.id === selectedFolderId) ?? allDocumentsFolder
  const selectedGroupId = selectedFolder.group?.groupId ?? ""
  const uploadDestination = uploadGroupId ? documentGroups.find((group) => group.groupId === uploadGroupId) : undefined
  const uploadDestinationLabel = uploadDestination?.name ?? "未選択"
  const canUploadToDestination = canWrite && Boolean(uploadGroupId)
  const visibleDocuments = selectedFolder.group ? documents.filter((document) => documentGroupIds(document).includes(selectedFolder.group!.groupId)) : documents
  const visibleChunkCount = visibleDocuments.reduce((sum, document) => sum + document.chunkCount, 0)
  const latestDocuments = [...documents].sort((left, right) => right.createdAt.localeCompare(left.createdAt)).slice(0, 3)
  const selectedSharedEntries = selectedFolder.group ? sharedEntries(selectedFolder.group) : []

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    if (!uploadFile || !canUploadToDestination) return
    await onUpload(uploadFile)
    setUploadFile(null)
  }

  async function onCreateGroupSubmit(event: FormEvent) {
    event.preventDefault()
    const name = groupName.trim()
    if (!name || !canWrite) return
    await onCreateGroup({ name, visibility: "private" })
    setGroupName("")
  }

  async function onShareSubmit(event: FormEvent) {
    event.preventDefault()
    const targetGroupId = shareGroupId || selectedGroupId
    if (!targetGroupId || !canWrite) return
    const groups = shareGroups.split(",").map((item) => item.trim()).filter(Boolean)
    await onShareGroup(targetGroupId, { visibility: groups.length > 0 ? "shared" : "private", sharedGroups: groups })
    setShareGroups("")
  }

  async function runConfirmedAction() {
    if (!confirmAction) return
    const action = confirmAction
    setConfirmAction(null)
    if (action.kind === "delete") await onDelete(action.document.documentId)
    if (action.kind === "stage") await onStageReindex(action.document.documentId)
    if (action.kind === "cutover") await onCutoverReindex(action.migration.migrationId)
    if (action.kind === "rollback") await onRollbackReindex(action.migration.migrationId)
  }

  function selectFolder(folderId: string, groupId: string) {
    setSelectedFolderId(folderId)
    onUploadGroupChange(groupId)
  }

  return (
    <section className="document-workspace" aria-label="ドキュメント管理">
      <header className="document-page-header">
        <div>
          <button className="document-back-button" type="button" onClick={onBack} title="管理者設定へ戻る" aria-label="管理者設定へ戻る">
            <Icon name="chevron" />
          </button>
          <div>
            <h2>ドキュメント管理</h2>
            <nav aria-label="パンくず">
              <span>ホーム</span>
              <span>/</span>
              <span>ドキュメント</span>
              <span>/</span>
              <strong>{selectedFolder.name}</strong>
            </nav>
          </div>
        </div>
        {loading && <LoadingStatus label="ドキュメント一覧を更新中" />}
      </header>

      <div className="document-management-layout">
        <DocumentFolderTree
          documents={documents}
          documentGroups={documentGroups}
          filteredFolders={filteredFolders}
          selectedFolder={selectedFolder}
          selectedFolderId={selectedFolderId}
          folderSearch={folderSearch}
          onFolderSearchChange={setFolderSearch}
          onSelectFolder={selectFolder}
        />
        <DocumentFilePanel
          documents={documents}
          documentGroups={documentGroups}
          selectedFolder={selectedFolder}
          uploadGroupId={uploadGroupId}
          uploadDestinationLabel={uploadDestinationLabel}
          visibleDocuments={visibleDocuments}
          operationState={operationState}
          canWrite={canWrite}
          canDelete={canDelete}
          canReindex={canReindex}
          canUploadToDestination={canUploadToDestination}
          migrations={migrations}
          uploadInputRef={uploadInputRef}
          shareSelectRef={shareSelectRef}
          onConfirmAction={setConfirmAction}
        />
        <DocumentDetailPanel
          documentGroups={documentGroups}
          selectedFolder={selectedFolder}
          selectedGroupId={selectedGroupId}
          selectedSharedEntries={selectedSharedEntries}
          visibleDocuments={visibleDocuments}
          visibleChunkCount={visibleChunkCount}
          uploadGroupId={uploadGroupId}
          uploadFile={uploadFile}
          uploadDestinationLabel={uploadDestinationLabel}
          uploadState={uploadState}
          latestDocuments={latestDocuments}
          groupName={groupName}
          shareGroupId={shareGroupId}
          shareGroups={shareGroups}
          canWrite={canWrite}
          canUploadToDestination={canUploadToDestination}
          operationState={operationState}
          uploadInputRef={uploadInputRef}
          shareSelectRef={shareSelectRef}
          onUploadFileChange={setUploadFile}
          onGroupNameChange={setGroupName}
          onShareGroupIdChange={setShareGroupId}
          onShareGroupsChange={setShareGroups}
          onUploadGroupChange={onUploadGroupChange}
          onUploadSubmit={(event) => void onSubmit(event)}
          onCreateGroupSubmit={(event) => void onCreateGroupSubmit(event)}
          onShareSubmit={(event) => void onShareSubmit(event)}
        />
      </div>
      {confirmAction && (
        <DocumentConfirmDialog
          action={confirmAction}
          documents={documents}
          documentGroups={documentGroups}
          onCancel={() => setConfirmAction(null)}
          onConfirm={() => void runConfirmedAction()}
        />
      )}
    </section>
  )
}
