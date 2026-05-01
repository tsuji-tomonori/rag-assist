import { FormEvent, useState } from "react"
import type { AuthResult, AuthSession, NewPasswordRequiredChallenge } from "./authClient.js"

type LoginPageProps = {
  onLogin: (payload: { email: string; password: string; remember: boolean }) => Promise<AuthResult>
  onCompleteNewPassword: (payload: {
    challenge: NewPasswordRequiredChallenge
    newPassword: string
    remember: boolean
  }) => Promise<AuthSession>
}

export default function LoginPage({ onLogin, onCompleteNewPassword }: LoginPageProps) {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [remember, setRemember] = useState(false)
  const [challenge, setChallenge] = useState<NewPasswordRequiredChallenge | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    if (challenge) {
      await submitNewPassword()
      return
    }
    if (!email || !password) return
    setIsSubmitting(true)
    setError(null)
    try {
      const result = await onLogin({ email, password, remember })
      if ("type" in result && result.type === "NEW_PASSWORD_REQUIRED") {
        setChallenge(result)
        setPassword("")
        setNewPassword("")
        setConfirmPassword("")
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setIsSubmitting(false)
    }
  }

  async function submitNewPassword() {
    if (!challenge || !newPassword || !confirmPassword) return
    if (newPassword !== confirmPassword) {
      setError("新しいパスワードが一致しません。")
      return
    }
    setIsSubmitting(true)
    setError(null)
    try {
      await onCompleteNewPassword({ challenge, newPassword, remember })
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setIsSubmitting(false)
    }
  }

  const isChangingPassword = challenge !== null

  return (
    <div className="login-page">
      <div className="login-hero" />
      <div className="login-panel">
        <h1>社内QAチャットボット</h1>
        <p>{isChangingPassword ? "初回ログイン用の新しいパスワードを設定" : "Cognitoで安全にサインイン"}</p>
        <form onSubmit={onSubmit} className="login-form">
          {isChangingPassword ? (
            <>
              <div className="login-challenge-summary">
                <span>ログインユーザー</span>
                <strong>{challenge.email}</strong>
              </div>
              <label>新しいパスワード</label>
              <input
                type="password"
                placeholder="新しいパスワードを入力"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
              />
              <label>新しいパスワード（確認）</label>
              <input
                type="password"
                placeholder="新しいパスワードを再入力"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
              />
            </>
          ) : (
            <>
              <label>メールアドレス</label>
              <input type="email" placeholder="メールアドレスを入力" value={email} onChange={(e) => setEmail(e.target.value)} />
              <label>パスワード</label>
              <input type="password" placeholder="パスワードを入力" value={password} onChange={(e) => setPassword(e.target.value)} />
            </>
          )}
          <label className="remember"><input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} /> ログイン状態を保持</label>
          {error ? <p className="login-error" role="alert">{error}</p> : null}
          <button type="submit" disabled={isSubmitting}>
            {isSubmitting ? (isChangingPassword ? "設定中" : "サインイン中") : isChangingPassword ? "パスワードを設定" : "サインイン"}
          </button>
        </form>
      </div>
    </div>
  )
}
