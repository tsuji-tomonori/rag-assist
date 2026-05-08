import type { FormEvent } from "react"
import type { SubmitShortcut } from "../../../app/types.js"
import type { DocumentGroup } from "../../documents/types.js"
import { Icon } from "../../../shared/components/Icon.js"
import { LoadingSpinner } from "../../../shared/components/LoadingSpinner.js"

export function ChatComposer({
  onAsk,
  question,
  submitShortcut,
  file,
  selectedGroupId,
  documentGroups,
  canWriteDocuments,
  conversationKey,
  canAsk,
  loading,
  onSetQuestion,
  onSetFile
}: {
  onAsk: (event: FormEvent) => Promise<void>
  question: string
  submitShortcut: SubmitShortcut
  file: File | null
  selectedGroupId: string
  documentGroups: DocumentGroup[]
  canWriteDocuments: boolean
  conversationKey: number
  canAsk: boolean
  loading: boolean
  onSetQuestion: (value: string) => void
  onSetFile: (file: File | null) => void
}) {
  const selectedGroupName = selectedGroupId === "all"
    ? "全フォルダ"
    : documentGroups.find((group) => group.groupId === selectedGroupId)?.name ?? "選択フォルダ"

  return (
    <form className="composer" onSubmit={onAsk}>
      <textarea
        aria-label="質問"
        placeholder={
          submitShortcut === "enter"
            ? "質問を入力してください...（Enterで送信 / Shift+Enterで改行）"
            : "質問を入力してください...（Ctrl+Enterで送信 / Enterで改行）"
        }
        value={question}
        disabled={loading}
        onChange={(event) => onSetQuestion(event.target.value)}
        onKeyDown={(event) => {
          if (event.key !== "Enter") return

          if (submitShortcut === "enter") {
            if (!event.shiftKey) {
              event.preventDefault()
              event.currentTarget.form?.requestSubmit()
            }
            return
          }

          if (event.ctrlKey || event.metaKey) {
            event.preventDefault()
            event.currentTarget.form?.requestSubmit()
          }
        }}
      />
      <div className="composer-actions">
        <span className="file-chip">{`参照: ${selectedGroupName}`}</span>
        {file && <span className="file-chip">{`一時添付: ${file.name}`}</span>}
        {canWriteDocuments && (
          <label className="icon-button attach-button" title="資料を添付">
            <Icon name="paperclip" />
            <input key={conversationKey} type="file" disabled={loading} onChange={(event) => onSetFile(event.target.files?.[0] ?? null)} />
          </label>
        )}
        <button className="send-button" disabled={!canAsk} type="submit" title="送信">
          {loading ? <LoadingSpinner className="button-spinner" /> : <Icon name="send" />}
        </button>
      </div>
    </form>
  )
}
