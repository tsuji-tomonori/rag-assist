import type { AuthSession } from "../../authClient.js"
import type { SubmitShortcut } from "../types.js"

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

        <label className="personal-setting-field" htmlFor="profile-submit-shortcut">
          <span>送信キー</span>
          <select
            id="profile-submit-shortcut"
            value={submitShortcut}
            onChange={(event) => onSetSubmitShortcut(event.target.value as SubmitShortcut)}
          >
            <option value="enter">Enterで送信</option>
            <option value="ctrlEnter">Ctrl+Enterで送信</option>
          </select>
        </label>

        <footer className="personal-settings-actions">
          <button className="secondary-action" type="button" onClick={onSignOut}>サインアウト</button>
        </footer>
      </div>
    </section>
  )
}
