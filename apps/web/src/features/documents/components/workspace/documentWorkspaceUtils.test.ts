import { describe, expect, it } from "vitest"
import type { DocumentGroup, DocumentManifest } from "../../types.js"
import {
  buildShareDiff,
  buildWorkspaceFolders,
  compareDocuments,
  documentGroupIds,
  documentGroupNames,
  documentStatusLabel,
  documentUpdatedAt,
  fileTypeClassName,
  fileTypeLabel,
  formatFileSize,
  metadataNumber,
  parseSharedGroups,
  uniqueSorted,
  visibilityLabel
} from "./documentWorkspaceUtils.js"

function document(overrides: Partial<DocumentManifest>): DocumentManifest {
  return {
    documentId: overrides.documentId ?? "doc",
    fileName: overrides.fileName ?? "document.md",
    chunkCount: overrides.chunkCount ?? 1,
    memoryCardCount: overrides.memoryCardCount ?? 0,
    createdAt: overrides.createdAt ?? "2026-05-01T00:00:00.000Z",
    ...overrides
  }
}

describe("documentWorkspaceUtils", () => {
  it("canonicalPathをフォルダパスとして使う", () => {
    const folders = buildWorkspaceFolders([group({
      groupId: "group-1",
      name: "同名",
      canonicalPath: "/親/同名"
    })], [])

    expect(folders[0]?.path).toBe("/ ドキュメントグループ/親/同名")
    expect(folders[0]?.group?.canonicalPath).toBe("/親/同名")
  })

  it("文書更新日時はmetadata.updatedAt、top-level updatedAt、createdAtの順に使う", () => {
    expect(documentUpdatedAt(document({
      createdAt: "2026-05-01T00:00:00.000Z",
      updatedAt: "2026-05-02T00:00:00.000Z",
      metadata: { updatedAt: "2026-05-03T00:00:00.000Z" }
    }))).toBe("2026-05-03T00:00:00.000Z")
    expect(documentUpdatedAt(document({
      createdAt: "2026-05-01T00:00:00.000Z",
      updatedAt: "2026-05-02T00:00:00.000Z",
      metadata: { updatedAt: "   " }
    }))).toBe("2026-05-02T00:00:00.000Z")
    expect(documentUpdatedAt(document({
      createdAt: "2026-05-01T00:00:00.000Z"
    }))).toBe("2026-05-01T00:00:00.000Z")
  })

  it("更新日ソートは文書更新日時を使う", () => {
    const oldDocument = document({
      documentId: "doc-old",
      fileName: "old.md",
      createdAt: "2026-05-01T00:00:00.000Z"
    })
    const topLevelUpdatedDocument = document({
      documentId: "doc-top-level",
      fileName: "top-level.md",
      createdAt: "2026-05-01T00:00:00.000Z",
      updatedAt: "2026-05-02T00:00:00.000Z"
    })
    const metadataUpdatedDocument = document({
      documentId: "doc-metadata",
      fileName: "metadata.md",
      createdAt: "2026-05-01T00:00:00.000Z",
      updatedAt: "2026-05-02T00:00:00.000Z",
      metadata: { updatedAt: "2026-05-03T00:00:00.000Z" }
    })

    expect([oldDocument, metadataUpdatedDocument, topLevelUpdatedDocument].sort((left, right) => compareDocuments(left, right, "updatedAsc")).map((item) => item.documentId)).toEqual([
      "doc-old",
      "doc-top-level",
      "doc-metadata"
    ])
    expect([oldDocument, metadataUpdatedDocument, topLevelUpdatedDocument].sort((left, right) => compareDocuments(left, right, "updatedDesc")).map((item) => item.documentId)).toEqual([
      "doc-metadata",
      "doc-top-level",
      "doc-old"
    ])
  })

  it("ファイル種別と表示用class名を安定して正規化する", () => {
    expect(fileTypeLabel(document({ fileName: "readme.markdown" }))).toBe("Markdown")
    expect(fileTypeLabel(document({ fileName: "policy.tex" }))).toBe("TeX")
    expect(fileTypeLabel(document({ fileName: "paper.pdf" }))).toBe("PDF")
    expect(fileTypeLabel(document({ fileName: "memo.doc" }))).toBe("Word")
    expect(fileTypeLabel(document({ fileName: "memo.docx" }))).toBe("Word")
    expect(fileTypeLabel(document({ fileName: "deck.ppt" }))).toBe("PowerPoint")
    expect(fileTypeLabel(document({ fileName: "deck.pptx" }))).toBe("PowerPoint")
    expect(fileTypeLabel(document({ fileName: "data.csv" }))).toBe("CSV")
    expect(fileTypeLabel(document({ fileName: "README" }))).toBe("README")
    expect(fileTypeLabel(document({ fileName: "", mimeType: "text/markdown" }))).toBe("Markdown")
    expect(fileTypeLabel(document({ fileName: "", mimeType: "text/plain" }))).toBe("Text")
    expect(fileTypeLabel(document({ fileName: "", mimeType: "application/msword" }))).toBe("Word")
    expect(fileTypeLabel(document({ fileName: "", mimeType: "application/vnd.openxmlformats-officedocument.presentationml.presentation" }))).toBe("PowerPoint")
    expect(fileTypeLabel(document({ fileName: "", mimeType: "application/octet-stream" }))).toBe("application/octet-stream")
    expect(fileTypeClassName("PowerPoint deck")).toBe("powerpoint-deck")
    expect(fileTypeClassName("!!!")).toBe("file")
  })

  it("文書グループ metadata、共有差分、数値 metadata を正規化する", () => {
    const groups = [
      group({ groupId: "group-a", name: "A", visibility: "org" }),
      group({ groupId: "group-b", name: "B", visibility: "shared" }),
      group({ groupId: "group-c", name: "C", visibility: "private" })
    ]
    expect(documentGroupIds(document({ metadata: { groupId: "group-a" } }))).toEqual(["group-a"])
    expect(documentGroupIds(document({ metadata: { groupIds: ["group-b", 1, "group-x"] } }))).toEqual(["group-b", "group-x"])
    expect(documentGroupIds(document({ metadata: { groupIds: 1 } }))).toEqual([])
    expect(documentGroupNames(document({ metadata: { groupIds: ["group-a", "missing"] } }), groups)).toEqual(["A", "missing"])
    expect(documentStatusLabel(document({ lifecycleStatus: "superseded" }))).toBe("superseded")
    expect(parseSharedGroups("HR,,HR, Sales")).toEqual({ groups: ["HR", "Sales"], duplicates: ["HR"], hasEmptyToken: true })
    expect(buildShareDiff(["HR", "Legal"], ["Legal", "Sales"])).toEqual({ added: ["Sales"], removed: ["HR"], unchanged: ["Legal"] })
    expect(uniqueSorted(["b", "a", "a"])).toEqual(["a", "b"])
    expect(metadataNumber(document({ metadata: { fileSize: 2048 } }), "fileSize")).toBe(2048)
    expect(metadataNumber(document({ metadata: { fileSize: Number.NaN } }), "fileSize")).toBeUndefined()
    expect(metadataNumber(document({ metadata: { fileSize: "2048" } }), "fileSize")).toBeUndefined()
    expect(formatFileSize(512)).toBe("512 B")
    expect(formatFileSize(1536)).toBe("1.5 KB")
    expect(formatFileSize(2 * 1024 * 1024)).toBe("2.0 MB")
    expect(groups.map(visibilityLabel)).toEqual(["A: 組織全体", "B: shared", "C: private"])
  })

  it("全ソートキーで安定した文書順を返す", () => {
    const alpha = document({ documentId: "alpha", fileName: "alpha.md", chunkCount: 1, createdAt: "2026-05-01T00:00:00.000Z" })
    const beta = document({ documentId: "beta", fileName: "beta.pdf", chunkCount: 10, createdAt: "2026-05-02T00:00:00.000Z" })
    const gamma = document({ documentId: "gamma", fileName: "gamma.tex", chunkCount: 5, createdAt: "2026-05-02T00:00:00.000Z" })
    expect([beta, alpha, gamma].sort((left, right) => compareDocuments(left, right, "fileNameAsc")).map((item) => item.documentId)).toEqual(["alpha", "beta", "gamma"])
    expect([alpha, gamma, beta].sort((left, right) => compareDocuments(left, right, "chunkDesc")).map((item) => item.documentId)).toEqual(["beta", "gamma", "alpha"])
    expect([gamma, beta, alpha].sort((left, right) => compareDocuments(left, right, "typeAsc")).map((item) => item.documentId)).toEqual(["alpha", "beta", "gamma"])
    expect([gamma, alpha, beta].sort((left, right) => compareDocuments(left, right, "updatedDesc")).map((item) => item.documentId)).toEqual(["beta", "gamma", "alpha"])
  })
})

function group(overrides: Partial<DocumentGroup>): DocumentGroup {
  return {
    groupId: "group",
    schemaVersion: 2,
    itemType: "documentGroup",
    tenantId: "default",
    adminPrincipalType: "user",
    adminPrincipalId: "user-1",
    name: "グループ",
    normalizedName: "グループ",
    canonicalPath: "/グループ",
    normalizedCanonicalPath: "/グループ",
    adminPathPk: "default#user#user-1",
    parentPathPk: "default#user#user-1#ROOT",
    visibility: "private",
    ownerUserId: "user-1",
    sharedUserIds: [],
    sharedGroups: [],
    managerUserIds: ["user-1"],
    createdAt: "2026-05-01T00:00:00.000Z",
    updatedAt: "2026-05-01T00:00:00.000Z",
    ...overrides
  }
}
