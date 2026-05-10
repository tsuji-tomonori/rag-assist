import { Icon } from "../../../../shared/components/Icon.js"
import type { DocumentGroup, DocumentManifest } from "../../types.js"
import type { WorkspaceFolder } from "./documentWorkspaceUtils.js"

export function DocumentFolderTree({
  documents,
  documentGroups,
  filteredFolders,
  selectedFolder,
  selectedFolderId,
  folderSearch,
  onFolderSearchChange,
  onSelectFolder
}: {
  documents: DocumentManifest[]
  documentGroups: DocumentGroup[]
  filteredFolders: WorkspaceFolder[]
  selectedFolder: WorkspaceFolder
  selectedFolderId: string
  folderSearch: string
  onFolderSearchChange: (value: string) => void
  onSelectFolder: (folderId: string, groupId: string) => void
}) {
  return (
    <aside className="document-folder-panel" aria-label="フォルダツリー">
      <div className="folder-search-row" role="search">
        <label className="sr-only" htmlFor="document-folder-search">フォルダを検索</label>
        <input
          id="document-folder-search"
          type="search"
          value={folderSearch}
          onChange={(event) => onFolderSearchChange(event.target.value)}
          placeholder="フォルダを検索"
          autoComplete="off"
        />
        <button type="button" title="フォルダ検索をクリア" aria-label="フォルダ検索をクリア" disabled={!folderSearch} onClick={() => onFolderSearchChange("")}>
          <Icon name="close" />
        </button>
      </div>
      <div className="folder-tree">
        <button
          className={`folder-tree-row ${selectedFolderId === "all" ? "active" : ""}`}
          type="button"
          aria-current={selectedFolderId === "all" ? "true" : undefined}
          onClick={() => onSelectFolder("all", "")}
        >
          <Icon name="folder" />
          <span>すべてのドキュメント</span>
          <strong>{documents.length}</strong>
        </button>
        <div className="folder-tree-group">
          <div className="folder-tree-row parent">
            <Icon name="folder" />
            <span>ドキュメントグループ</span>
            <strong>{documentGroups.length}</strong>
          </div>
          {filteredFolders.map((folder) => (
            <button
              className={`folder-tree-row child ${selectedFolder.id === folder.id ? "active" : ""}`}
              type="button"
              key={folder.id}
              aria-current={selectedFolder.id === folder.id ? "true" : undefined}
              onClick={() => onSelectFolder(folder.id, folder.group?.groupId ?? "")}
            >
              <Icon name="folder" />
              <span>{folder.name}</span>
              <strong>{folder.count}</strong>
            </button>
          ))}
          {documentGroups.length === 0 ? (
            <p className="folder-tree-empty">登録済みグループはありません。</p>
          ) : filteredFolders.length === 0 ? (
            <p className="folder-tree-empty">一致するフォルダはありません。</p>
          ) : null}
        </div>
      </div>
    </aside>
  )
}
