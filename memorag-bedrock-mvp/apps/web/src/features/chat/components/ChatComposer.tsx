import type { FormEvent } from "react"
import { Icon } from "../../../shared/components/Icon.js"

export function ChatComposer({
  onAsk,
  question,
  submitShortcut,
  file,
  canWriteDocuments,
  conversationKey,
  canAsk,
  onSetQuestion,
  onSetFile,
  onSetSubmitShortcut
}: {
  onAsk: (event: FormEvent) => Promise<void>
  question: string
  submitShortcut: "enter" | "ctrlEnter"
  file: File | null
  canWriteDocuments: boolean
  conversationKey: number
  canAsk: boolean
  onSetQuestion: (value: string) => void
  onSetFile: (file: File | null) => void
  onSetSubmitShortcut: (value: "enter" | "ctrlEnter") => void
}) {
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
        <div className="composer-shortcut-toggle">
          <label htmlFor="submit-shortcut">送信キー</label>
          <select id="submit-shortcut" value={submitShortcut} onChange={(event) => onSetSubmitShortcut(event.target.value as "enter" | "ctrlEnter")}>
            <option value="enter">Enterで送信</option>
            <option value="ctrlEnter">Ctrl+Enterで送信</option>
          </select>
        </div>
        {file && <span className="file-chip">{file.name}</span>}
        {canWriteDocuments && (
          <label className="icon-button attach-button" title="資料を添付">
            <Icon name="paperclip" />
            <input key={conversationKey} type="file" onChange={(event) => onSetFile(event.target.files?.[0] ?? null)} />
          </label>
        )}
        <button className="send-button" disabled={!canAsk} type="submit" title="送信">
          <Icon name="send" />
        </button>
      </div>
    </form>
  )
}
