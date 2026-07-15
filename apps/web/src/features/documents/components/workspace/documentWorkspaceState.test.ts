import { describe, expect, it } from "vitest"
import type { DocumentGroup, DocumentManifest, ReindexMigration } from "../../types.js"
import { documentWorkspaceNormalizationMessage, normalizeDocumentWorkspaceUrlState } from "./documentWorkspaceState.js"

const documents: DocumentManifest[] = [{
  documentId: "doc-allowed",
  fileName: "allowed.pdf",
  mimeType: "application/pdf",
  lifecycleStatus: "active",
  createdAt: "2026-07-14T00:00:00.000Z"
}]
const documentGroups: DocumentGroup[] = [{
  groupId: "group-allowed",
  name: "許可済み",
  canonicalPath: "/group-allowed",
  visibility: "private",
  effectivePermission: "readOnly",
  detailLevel: "reader",
  createdAt: "2026-07-14T00:00:00.000Z",
  updatedAt: "2026-07-14T00:00:00.000Z"
}]
const migrations: ReindexMigration[] = [{
  migrationId: "migration-allowed",
  sourceDocumentId: "doc-allowed",
  stagedDocumentId: "doc-staged",
  status: "staged",
  createdBy: "user-allowed",
  createdAt: "2026-07-14T00:00:00.000Z",
  updatedAt: "2026-07-14T00:00:00.000Z",
  previousManifestObjectKey: "manifests/previous.json",
  stagedManifestObjectKey: "manifests/staged.json"
}]

describe("documentWorkspaceState", () => {
  it("許可された selection/filter/page はそのまま保持する", () => {
    expect(normalizeDocumentWorkspaceUrlState({
      state: {
        folderId: "group-allowed",
        documentId: "doc-allowed",
        migrationId: "migration-allowed",
        type: "PDF",
        status: "active",
        groupFilter: "group-allowed",
        sort: "fileNameAsc",
        page: 2,
        pageSize: 50
      },
      documents,
      documentGroups,
      migrations,
      showManagementControls: true
    })).toEqual({
      state: {
        folderId: "group-allowed",
        documentId: "doc-allowed",
        migrationId: "migration-allowed",
        type: "PDF",
        status: "active",
        groupFilter: "group-allowed",
        sort: "fileNameAsc",
        page: 2,
        pageSize: 50
      },
      reasons: []
    })
  })

  it("存在しない・権限外の識別子や管理者専用 filter を値の再掲なしで正規化する", () => {
    const result = normalizeDocumentWorkspaceUrlState({
      state: {
        folderId: "secret-folder",
        documentId: "secret-document",
        migrationId: "secret-migration",
        type: "内部形式",
        status: "active",
        groupFilter: "secret-group",
        sort: "chunkDesc",
        page: 0,
        pageSize: 500
      },
      documents,
      documentGroups,
      migrations,
      showManagementControls: false
    })

    expect(result.state).toEqual({})
    expect(result.reasons).toEqual(["folder", "document", "migration", "group", "type", "status", "sort", "page", "pageSize"])
    const message = documentWorkspaceNormalizationMessage(result.reasons)
    expect(message).toContain("許可された既定値")
    expect(message).not.toContain("secret")
  })
})
