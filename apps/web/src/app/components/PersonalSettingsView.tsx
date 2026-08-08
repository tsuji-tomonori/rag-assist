import { useState } from "react"
import type { AuthSession } from "../../features/auth/api/authClient.js"
import type { SubmitShortcut } from "../types.js"

const submitShortcutLabels: Record<SubmitShortcut, string> = {
  enter: "Enterで送信",
  ctrlEnter: "Ctrl+Enterで送信"
}

export function PersonalSettingsView({
  authSession,
  submitShortcut,
  onSetSubmitShortcut,
  onSignOut,
  onBack
}: {
  authSession: AuthSession
  submitShortcut: SubmitShortcut
  onSetSubmitShortcut: (value: SubmitShortcut) => void
  onSignOut: () => void
  onBack: () => void
}) {
  const [shortcutStatus, setShortcutStatus] = useState("")

  const handleSubmitShortcutChange = (value: SubmitShortcut) => {
    onSetSubmitShortcut(value)
    setShortcutStatus(`送信キーを「${submitShortcutLabels[value]}」に変更しました。この設定は現在のサインイン中だけ有効です。`)
  }

  return (
    <section className="settings-workspace" aria-label="個人設定">
      <div className="personal-settings-card">
        <header className="workspace-head">
          <div>
            <span>Personal settings</span>
            <h2>個人設定</h2>
          </div>
          <button type="button" onClick={onBack}>チャットへ戻る</button>
        </header>

        <dl className="personal-settings-list">
          <div>
            <dt>メールアドレス</dt>
            <dd className="personal-email">{authSession.email}</dd>
          </div>
        </dl>

        <div className="personal-setting-field">
          <label htmlFor="profile-submit-shortcut">送信キー</label>
          <select
            id="profile-submit-shortcut"
            aria-describedby="profile-submit-shortcut-help"
            value={submitShortcut}
            onChange={(event) => handleSubmitShortcutChange(event.target.value as SubmitShortcut)}
          >
            <option value="enter">Enterで送信</option>
            <option value="ctrlEnter">Ctrl+Enterで送信</option>
          </select>
          <small id="profile-submit-shortcut-help" className="personal-setting-help">
            現在のサインイン中だけ有効です。再読み込みまたは再サインインすると、既定の「Enterで送信」に戻ります。
          </small>
        </div>

        {shortcutStatus ? <p className="personal-setting-status" role="status" aria-live="polite">{shortcutStatus}</p> : null}

        <footer className="personal-settings-actions">
          <button className="secondary-action" type="button" onClick={onSignOut}>サインアウト</button>
        </footer>
      </div>
    </section>
  )
}
