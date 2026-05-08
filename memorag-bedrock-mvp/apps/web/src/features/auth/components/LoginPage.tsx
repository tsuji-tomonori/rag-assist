import { type FormEvent, useState } from "react"
import type { AuthResult, AuthSession, NewPasswordRequiredChallenge, SignUpResult } from "../../../authClient.js"
import { LoadingSpinner } from "../../../shared/components/LoadingSpinner.js"
import { LoginHeroGraphic } from "./LoginHeroGraphic.js"

type LoginPageProps = {
  onLogin: (payload: { email: string; password: string; remember: boolean }) => Promise<AuthResult>
  onSignUp: (payload: { email: string; password: string }) => Promise<SignUpResult>
  onConfirmSignUp: (payload: { email: string; code: string }) => Promise<void>
  onCompleteNewPassword: (payload: {
    challenge: NewPasswordRequiredChallenge
    newPassword: string
    remember: boolean
  }) => Promise<AuthSession>
}

type LoginMode = "signIn" | "signUp" | "confirmSignUp"

type PasswordRequirement = {
  readonly id: string
  readonly label: string
  readonly validate: (password: string) => boolean
}

const passwordRequirements: readonly PasswordRequirement[] = [
  { id: "length", label: "12文字以上", validate: (password) => password.length >= 12 },
  { id: "lowercase", label: "小文字を1文字以上", validate: (password) => /[a-z]/.test(password) },
  { id: "uppercase", label: "大文字を1文字以上", validate: (password) => /[A-Z]/.test(password) },
  { id: "digit", label: "数字を1文字以上", validate: (password) => /\d/.test(password) },
  { id: "symbol", label: "記号を1文字以上", validate: (password) => /[^A-Za-z0-9]/.test(password) }
] as const

function isPasswordPolicySatisfied(password: string) {
  return passwordRequirements.every((requirement) => requirement.validate(password))
}

function PasswordRequirementList({ password }: { password: string }) {
  return (
    <div className="password-requirements" aria-live="polite">
      <span className="password-requirements-title">パスワード条件</span>
      <ul>
        {passwordRequirements.map((requirement) => {
          const isMet = requirement.validate(password)
          return (
            <li
              key={requirement.id}
              className={isMet ? "password-requirement password-requirement-met" : "password-requirement"}
              aria-label={`${isMet ? "達成" : "未達成"}: ${requirement.label}`}
            >
              <span className="password-requirement-icon" aria-hidden="true">{isMet ? "✓" : ""}</span>
              <span>{requirement.label}</span>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

export default function LoginPage({ onLogin, onSignUp, onConfirmSignUp, onCompleteNewPassword }: LoginPageProps) {
  const [mode, setMode] = useState<LoginMode>("signIn")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [signUpPasswordConfirm, setSignUpPasswordConfirm] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [confirmationCode, setConfirmationCode] = useState("")
  const [remember, setRemember] = useState(false)
  const [challenge, setChallenge] = useState<NewPasswordRequiredChallenge | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    if (challenge) {
      await submitNewPassword()
      return
    }
    if (mode === "signUp") {
      await submitSignUp()
      return
    }
    if (mode === "confirmSignUp") {
      await submitConfirmSignUp()
      return
    }
    if (!email || !password) return
    setIsSubmitting(true)
    setError(null)
    setNotice(null)
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
    if (!isPasswordPolicySatisfied(newPassword)) {
      setError("未達成のパスワード条件を確認してください。")
      return
    }
    if (newPassword !== confirmPassword) {
      setError("新しいパスワードが一致しません。")
      return
    }
    setIsSubmitting(true)
    setError(null)
    setNotice(null)
    try {
      await onCompleteNewPassword({ challenge, newPassword, remember })
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setIsSubmitting(false)
    }
  }

  async function submitSignUp() {
    if (!email || !password || !signUpPasswordConfirm) return
    if (!isPasswordPolicySatisfied(password)) {
      setError("未達成のパスワード条件を確認してください。")
      return
    }
    if (password !== signUpPasswordConfirm) {
      setError("パスワードが一致しません。")
      return
    }
    setIsSubmitting(true)
    setError(null)
    setNotice(null)
    try {
      const result = await onSignUp({ email, password })
      setMode("confirmSignUp")
      setPassword("")
      setSignUpPasswordConfirm("")
      setConfirmationCode("")
      setNotice(result.deliveryDestination ? `確認コードを ${result.deliveryDestination} に送信しました。` : "確認コードを送信しました。")
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setIsSubmitting(false)
    }
  }

  async function submitConfirmSignUp() {
    if (!email || !confirmationCode) return
    setIsSubmitting(true)
    setError(null)
    setNotice(null)
    try {
      await onConfirmSignUp({ email, code: confirmationCode })
      setMode("signIn")
      setConfirmationCode("")
      setNotice("アカウントを確認しました。サインインしてください。")
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setIsSubmitting(false)
    }
  }

  function switchMode(nextMode: LoginMode) {
    setMode(nextMode)
    setChallenge(null)
    setPassword("")
    setSignUpPasswordConfirm("")
    setNewPassword("")
    setConfirmPassword("")
    setConfirmationCode("")
    setError(null)
    setNotice(null)
  }

  const isChangingPassword = challenge !== null
  const isCurrentPasswordValid = isChangingPassword ? isPasswordPolicySatisfied(newPassword) : mode === "signUp" ? isPasswordPolicySatisfied(password) : true
  const title =
    isChangingPassword ? "初回ログイン用の新しいパスワードを設定" : mode === "signUp" ? "アカウントを作成" : mode === "confirmSignUp" ? "確認コードを入力" : "Cognitoで安全にサインイン"
  const submitLabel = isSubmitting
    ? isChangingPassword
      ? "設定中"
      : mode === "signUp"
        ? "作成中"
        : mode === "confirmSignUp"
          ? "確認中"
          : "サインイン中"
    : isChangingPassword
      ? "パスワードを設定"
      : mode === "signUp"
        ? "アカウントを作成"
        : mode === "confirmSignUp"
          ? "確認する"
          : "サインイン"

  return (
    <div className="login-page">
      <div className="login-hero" data-testid="login-hero" aria-hidden="true">
        <LoginHeroGraphic />
      </div>
      <div className="login-panel">
        <h1>社内QAチャットボット</h1>
        <p>{title}</p>
        <form onSubmit={onSubmit} className="login-form" aria-label={title} aria-describedby={error ? "login-error" : notice ? "login-notice" : undefined}>
          {isChangingPassword ? (
            <>
              <div className="login-challenge-summary">
                <span>ログインユーザー</span>
                <strong>{challenge.email}</strong>
              </div>
              <label>新しいパスワード</label>
              <input
                type="password"
                aria-label="新しいパスワード"
                placeholder="新しいパスワードを入力"
                value={newPassword}
                disabled={isSubmitting}
                onChange={(e) => setNewPassword(e.target.value)}
              />
              <PasswordRequirementList password={newPassword} />
              <label>新しいパスワード（確認）</label>
              <input
                type="password"
                aria-label="新しいパスワード（確認）"
                placeholder="新しいパスワードを再入力"
                value={confirmPassword}
                disabled={isSubmitting}
                onChange={(e) => setConfirmPassword(e.target.value)}
              />
            </>
          ) : mode === "confirmSignUp" ? (
            <>
              <label>メールアドレス</label>
              <input type="email" aria-label="メールアドレス" placeholder="メールアドレスを入力" value={email} disabled={isSubmitting} onChange={(e) => setEmail(e.target.value)} />
              <label>確認コード</label>
              <input
                type="text"
                inputMode="numeric"
                aria-label="確認コード"
                placeholder="確認コードを入力"
                value={confirmationCode}
                disabled={isSubmitting}
                onChange={(e) => setConfirmationCode(e.target.value)}
              />
            </>
          ) : mode === "signUp" ? (
            <>
              <label>メールアドレス</label>
              <input type="email" aria-label="メールアドレス" placeholder="メールアドレスを入力" value={email} disabled={isSubmitting} onChange={(e) => setEmail(e.target.value)} />
              <label>パスワード</label>
              <input type="password" aria-label="パスワード" placeholder="パスワードを入力" value={password} disabled={isSubmitting} onChange={(e) => setPassword(e.target.value)} />
              <PasswordRequirementList password={password} />
              <label>パスワード（確認）</label>
              <input
                type="password"
                aria-label="パスワード（確認）"
                placeholder="パスワードを再入力"
                value={signUpPasswordConfirm}
                disabled={isSubmitting}
                onChange={(e) => setSignUpPasswordConfirm(e.target.value)}
              />
            </>
          ) : (
            <>
              <label>メールアドレス</label>
              <input type="email" aria-label="メールアドレス" placeholder="メールアドレスを入力" value={email} disabled={isSubmitting} onChange={(e) => setEmail(e.target.value)} />
              <label>パスワード</label>
              <input type="password" aria-label="パスワード" placeholder="パスワードを入力" value={password} disabled={isSubmitting} onChange={(e) => setPassword(e.target.value)} />
            </>
          )}
          {!isChangingPassword && mode === "signIn" ? (
            <label className="remember"><input type="checkbox" checked={remember} disabled={isSubmitting} onChange={(e) => setRemember(e.target.checked)} /> ログイン状態を保持</label>
          ) : null}
          {notice ? <p id="login-notice" className="login-success" role="status">{notice}</p> : null}
          {error ? <p id="login-error" className="login-error" role="alert">{error}</p> : null}
          <button type="submit" disabled={isSubmitting || !isCurrentPasswordValid}>
            {isSubmitting && <LoadingSpinner className="button-spinner" />}
            <span>{submitLabel}</span>
          </button>
          {!isChangingPassword ? (
            <div className="login-secondary-actions">
              {mode === "signIn" ? (
                <>
                  <button type="button" className="login-text-button" disabled={isSubmitting} onClick={() => switchMode("signUp")}>アカウント作成</button>
                  <button type="button" className="login-text-button" disabled={isSubmitting} onClick={() => switchMode("confirmSignUp")}>確認コード入力</button>
                </>
              ) : (
                <button type="button" className="login-text-button" disabled={isSubmitting} onClick={() => switchMode("signIn")}>サインインへ戻る</button>
              )}
            </div>
          ) : null}
        </form>
      </div>
    </div>
  )
}
