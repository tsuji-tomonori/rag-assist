import { describe, expect, it } from "vitest"
import type { DocumentManifest } from "../../types.js"
import { buildOperationEvents, compareDocuments, documentUpdatedAt } from "./documentWorkspaceUtils.js"

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

  it("更新日ソートと文書更新イベントは同じ更新日時を使う", () => {
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

    expect(buildOperationEvents({
      documents: [oldDocument, metadataUpdatedDocument, topLevelUpdatedDocument],
      documentGroups: [],
      migrations: [],
      uploadState: null,
      sessionOperationEvents: []
    }).map((event) => event.occurredAt)).toEqual([
      "2026-05-03T00:00:00.000Z",
      "2026-05-02T00:00:00.000Z",
      "2026-05-01T00:00:00.000Z"
    ])
  })
})
