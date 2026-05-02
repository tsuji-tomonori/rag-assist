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
      <div className="login-hero" aria-hidden="true">
        <LoginHeroGraphic />
      </div>
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

function LoginHeroGraphic() {
  return (
    <svg className="login-hero-graphic" viewBox="0 0 960 900" role="img">
      <defs>
        <linearGradient id="heroShield" x1="245" x2="535" y1="306" y2="640" gradientUnits="userSpaceOnUse">
          <stop stopColor="#f8fbff" />
          <stop offset="0.54" stopColor="#9dc2ff" />
          <stop offset="1" stopColor="#3676dc" />
        </linearGradient>
        <linearGradient id="heroLock" x1="365" x2="485" y1="430" y2="575" gradientUnits="userSpaceOnUse">
          <stop stopColor="#fff" />
          <stop offset="1" stopColor="#d7e7ff" />
        </linearGradient>
        <radialGradient id="heroNode" cx="0" cy="0" r="1" gradientTransform="translate(182 246) rotate(90) scale(64)">
          <stop stopColor="#4d96f6" />
          <stop offset="1" stopColor="#dceaff" />
        </radialGradient>
        <filter id="softShadow" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="18" stdDeviation="18" floodColor="#2b6dd8" floodOpacity="0.18" />
        </filter>
      </defs>

      <g className="hero-network">
        <path d="M4 446h224l164-265 207 59 171 184" />
        <path d="M88 784 226 678l166 35 198-167 238 206" />
        <path d="M143 250 290 358l207-190 164 114 83 235" />
        <path d="M7 795 167 782l189 103 234-202 274 24" />
        <path d="M216 203v474M402 162v551M590 238v450" strokeDasharray="10 14" />
        <path d="M62 651c119-105 285-137 427-77 125 53 221 42 336-38" strokeDasharray="8 18" />
      </g>

      <g className="hero-orbits">
        <circle cx="410" cy="468" r="164" />
        <circle cx="410" cy="468" r="226" />
        <circle cx="410" cy="468" r="288" strokeDasharray="14 16" />
        <path d="M130 455c117-142 305-192 480-126" strokeDasharray="12 18" />
        <path d="M158 612c141 92 329 89 467-17" strokeDasharray="12 18" />
      </g>

      <g className="hero-nodes">
        <circle cx="143" cy="250" r="9" />
        <circle cx="216" cy="203" r="11" />
        <circle cx="290" cy="358" r="8" />
        <circle cx="402" cy="162" r="9" />
        <circle cx="497" cy="168" r="10" />
        <circle cx="590" cy="238" r="8" />
        <circle cx="770" cy="424" r="9" />
        <circle cx="226" cy="678" r="9" />
        <circle cx="392" cy="713" r="9" />
        <circle cx="590" cy="688" r="8" />
        <circle cx="828" cy="752" r="9" />
        <circle cx="88" cy="784" r="7" />
      </g>

      <g className="hero-badge hero-user" transform="translate(116 246)">
        <circle r="72" />
        <circle r="48" />
        <path d="M0-28a18 18 0 1 1 0 36 18 18 0 0 1 0-36Zm-34 84c3-25 17-38 34-38s31 13 34 38h-68Z" />
      </g>

      <g className="hero-badge hero-cloud" transform="translate(704 315)">
        <circle r="72" />
        <circle r="48" />
        <path d="M-34 24h70a22 22 0 0 0 5-43 34 34 0 0 0-64-8 28 28 0 0 0-11 51Z" />
      </g>

      <g className="hero-badge hero-fingerprint" transform="translate(164 626)">
        <circle r="72" />
        <circle r="48" />
        <path d="M-32-3c3-22 19-36 42-34 23 2 37 18 36 40" />
        <path d="M-19 38c12-18 13-30 10-43" />
        <path d="M0 44c8-15 11-29 6-48" />
        <path d="M19 38c7-17 7-35-4-45-10-9-27-6-32 8" />
        <path d="M35 20c5-24-5-43-23-49-20-7-41 2-50 22" />
      </g>

      <g className="hero-badge hero-check" transform="translate(690 672)">
        <circle r="72" />
        <circle r="48" />
        <path d="m-28-1 20 21 39-43" />
      </g>

      <g className="hero-shield" filter="url(#softShadow)">
        <path d="M410 314c-51 54-118 71-118 71v133c0 82 55 126 118 159 63-33 118-77 118-159V385s-67-17-118-71Z" />
        <path d="M410 353c-35 35-78 49-78 49v109c0 54 33 87 78 113 45-26 78-59 78-113V402s-43-14-78-49Z" />
        <path d="M410 353v271" />
      </g>

      <g className="hero-lock" filter="url(#softShadow)">
        <rect x="350" y="458" width="120" height="92" rx="20" />
        <path d="M376 458v-34a34 34 0 0 1 68 0v34" />
        <circle cx="410" cy="504" r="13" />
        <path d="M410 514v26" />
      </g>

      <g className="hero-skyline">
        <path d="M32 741h64v-62h54v-39h68v70h42v-112h66v143h47v-65h62v65h48v-102h72v102h42v-144h70v144h44v-74h60v74h49v-118h62v118h48v159H32V741Z" />
        <path d="M0 754h960v146H0z" />
      </g>
    </svg>
  )
}
