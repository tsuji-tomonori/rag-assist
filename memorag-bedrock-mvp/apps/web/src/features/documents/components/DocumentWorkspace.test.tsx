import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"
import { DocumentWorkspace } from "./DocumentWorkspace.js"

const documents = [
  { documentId: "doc-1", fileName: "requirements.md", chunkCount: 2, memoryCardCount: 1, createdAt: "2026-05-01T00:00:00.000Z" }
]

describe("DocumentWorkspace", () => {
  it("登録文書を表示し、削除操作を通知する", async () => {
    const onDelete = vi.fn().mockResolvedValue(undefined)

    render(
      <DocumentWorkspace
        documents={documents}
        loading={false}
        canWrite={true}
        canDelete={true}
        onUpload={vi.fn()}
        onDelete={onDelete}
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
        loading={false}
        canWrite={true}
        canDelete={false}
        onUpload={vi.fn()}
        onDelete={vi.fn()}
        onBack={vi.fn()}
      />
    )

    expect(screen.getByTitle("requirements.mdを削除")).toBeDisabled()
  })
})
