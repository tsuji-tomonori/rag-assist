import { FormEvent, useState } from "react"

type LoginPageProps = {
  onLogin: (payload: { email: string; password: string; remember: boolean }) => Promise<void>
}

export default function LoginPage({ onLogin }: LoginPageProps) {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [remember, setRemember] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    if (!email || !password) return
    setIsSubmitting(true)
    setError(null)
    try {
      await onLogin({ email, password, remember })
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="login-page">
      <div className="login-hero" />
      <div className="login-panel">
        <h1>社内QAチャットボット</h1>
        <p>Cognitoで安全にサインイン</p>
        <form onSubmit={onSubmit} className="login-form">
          <label>メールアドレス</label>
          <input type="email" placeholder="メールアドレスを入力" value={email} onChange={(e) => setEmail(e.target.value)} />
          <label>パスワード</label>
          <input type="password" placeholder="パスワードを入力" value={password} onChange={(e) => setPassword(e.target.value)} />
          <label className="remember"><input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} /> ログイン状態を保持</label>
          {error ? <p className="login-error" role="alert">{error}</p> : null}
          <button type="submit" disabled={isSubmitting}>{isSubmitting ? "サインイン中" : "サインイン"}</button>
        </form>
      </div>
    </div>
  )
}
