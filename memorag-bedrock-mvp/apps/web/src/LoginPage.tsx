import { FormEvent, useState } from "react"

type LoginPageProps = {
  onLogin: (payload: { email: string }) => void
}

export default function LoginPage({ onLogin }: LoginPageProps) {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")

  function onSubmit(event: FormEvent) {
    event.preventDefault()
    if (!email || !password) return
    onLogin({ email })
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
          <label className="remember"><input type="checkbox" /> ログイン状態を保持</label>
          <button type="submit">サインイン</button>
        </form>
      </div>
    </div>
  )
}
