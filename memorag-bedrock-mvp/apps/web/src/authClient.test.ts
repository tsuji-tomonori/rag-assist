import { describe, expect, it, vi } from "vitest"
import { listDocuments, resetRuntimeConfigForTests } from "./api.js"
import { completeNewPasswordChallenge, confirmSignUp, getStoredAuthSession, signIn, signOut, signUp } from "./authClient.js"

function response(body: unknown, ok = true) {
  return {
    ok,
    json: vi.fn().mockResolvedValue(body),
    text: vi.fn().mockResolvedValue(typeof body === "string" ? body : JSON.stringify(body))
  }
}

function jwtWithGroups(groups: string[]) {
  const encode = (value: unknown) => Buffer.from(JSON.stringify(value)).toString("base64url")
  return `${encode({ alg: "none", typ: "JWT" })}.${encode({ sub: "user-1", "cognito:groups": groups })}.signature`
}

describe("auth client", () => {
  it("signs in with Cognito and attaches the ID token to API requests", async () => {
    const idToken = jwtWithGroups(["CHAT_USER", "ANSWER_EDITOR"])
    const fetchMock = vi.fn((url: RequestInfo | URL, _init?: RequestInit) => {
      const requestUrl = String(url)
      if (requestUrl === "/config.json") {
        return Promise.resolve(
          response({
            apiBaseUrl: "http://api.test",
            authMode: "cognito",
            cognitoRegion: "ap-northeast-1",
            cognitoUserPoolClientId: "client-1"
          })
        )
      }
      if (requestUrl === "https://cognito-idp.ap-northeast-1.amazonaws.com/") {
        return Promise.resolve(
          response({
            AuthenticationResult: {
              IdToken: idToken,
              AccessToken: "access-token",
              RefreshToken: "refresh-token",
              ExpiresIn: 3600
            }
          })
        )
      }
      if (requestUrl === "http://api.test/documents") return Promise.resolve(response({ documents: [] }))
      return Promise.resolve(response({}))
    })
    vi.stubGlobal("fetch", fetchMock)

    await expect(signIn({ email: "tester@example.com", password: "Password123!", remember: true })).resolves.toMatchObject({
      email: "tester@example.com",
      idToken,
      cognitoGroups: ["CHAT_USER", "ANSWER_EDITOR"]
    })
    await expect(listDocuments()).resolves.toEqual([])

    expect(fetchMock).toHaveBeenCalledWith(
      "https://cognito-idp.ap-northeast-1.amazonaws.com/",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({ "X-Amz-Target": "AWSCognitoIdentityProviderService.InitiateAuth" }),
        body: expect.stringContaining("\"PASSWORD\":\"Password123!\"")
      })
    )
    expect(fetchMock).toHaveBeenCalledWith("http://api.test/documents", { headers: { Authorization: `Bearer ${idToken}` } })
    expect(getStoredAuthSession()?.idToken).toBe(idToken)
    expect(getStoredAuthSession()?.cognitoGroups).toEqual(["CHAT_USER", "ANSWER_EDITOR"])
  })

  it("rejects bad Cognito credentials and does not create a session", async () => {
    const fetchMock = vi.fn((url: RequestInfo | URL) => {
      const requestUrl = String(url)
      if (requestUrl === "/config.json") {
        return Promise.resolve(
          response({
            authMode: "cognito",
            cognitoRegion: "ap-northeast-1",
            cognitoUserPoolClientId: "client-1"
          })
        )
      }
      if (requestUrl === "https://cognito-idp.ap-northeast-1.amazonaws.com/") {
        return Promise.resolve(response({ __type: "NotAuthorizedException" }, false))
      }
      return Promise.resolve(response({}))
    })
    vi.stubGlobal("fetch", fetchMock)

    await expect(signIn({ email: "tester@example.com", password: "wrong", remember: false })).rejects.toThrow(
      "メールアドレスまたはパスワードが正しくありません。"
    )
    expect(getStoredAuthSession()).toBeNull()
  })

  it("rejects incomplete Cognito configuration and returns new password challenges", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response({ authMode: "cognito" })))
    await expect(signIn({ email: "tester@example.com", password: "Password123!", remember: false })).rejects.toThrow("Cognito認証設定が未設定です。")

    resetRuntimeConfigForTests()
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(response({ authMode: "cognito", cognitoRegion: "ap-northeast-1", cognitoUserPoolClientId: "client-1" }))
        .mockResolvedValueOnce(
          response({
            ChallengeName: "NEW_PASSWORD_REQUIRED",
            Session: "challenge-session",
            ChallengeParameters: { requiredAttributes: "[\"email\"]" }
          })
        )
    )
    await expect(signIn({ email: "tester@example.com", password: "Password123!", remember: false })).resolves.toEqual({
      type: "NEW_PASSWORD_REQUIRED",
      email: "tester@example.com",
      session: "challenge-session",
      requiredAttributes: ["email"]
    })
    expect(getStoredAuthSession()).toBeNull()
  })

  it("completes the new password challenge and stores the session", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(response({ authMode: "cognito", cognitoRegion: "ap-northeast-1", cognitoUserPoolClientId: "client-1" }))
      .mockResolvedValueOnce(
        response({
          AuthenticationResult: {
            IdToken: "new-id-token",
            AccessToken: "new-access-token",
            RefreshToken: "new-refresh-token",
            ExpiresIn: 3600
          }
        })
      )
    vi.stubGlobal("fetch", fetchMock)

    await expect(
      completeNewPasswordChallenge({
        challenge: {
          type: "NEW_PASSWORD_REQUIRED",
          email: "tester@example.com",
          session: "challenge-session",
          requiredAttributes: []
        },
        newPassword: "NewPassword123!",
        remember: true
      })
    ).resolves.toMatchObject({ email: "tester@example.com", idToken: "new-id-token" })

    expect(fetchMock).toHaveBeenCalledWith(
      "https://cognito-idp.ap-northeast-1.amazonaws.com/",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({ "X-Amz-Target": "AWSCognitoIdentityProviderService.RespondToAuthChallenge" }),
        body: expect.stringContaining("\"NEW_PASSWORD\":\"NewPassword123!\"")
      })
    )
    expect(getStoredAuthSession()?.idToken).toBe("new-id-token")
  })

  it("rejects Cognito success responses without an ID token", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(response({ authMode: "cognito", cognitoRegion: "ap-northeast-1", cognitoUserPoolClientId: "client-1" }))
        .mockResolvedValueOnce(response({ AuthenticationResult: { AccessToken: "access-token" } }))
    )

    await expect(signIn({ email: "tester@example.com", password: "Password123!", remember: false })).rejects.toThrow(
      "Cognito認証レスポンスにIDトークンがありません。"
    )
  })

  it("signs up and confirms a Cognito user", async () => {
    resetRuntimeConfigForTests()
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(response({ authMode: "cognito", cognitoRegion: "ap-northeast-1", cognitoUserPoolClientId: "client-1" }))
      .mockResolvedValueOnce(response({ CodeDeliveryDetails: { Destination: "t***@example.com" } }))
      .mockResolvedValueOnce(response({}))
    vi.stubGlobal("fetch", fetchMock)

    await expect(signUp({ email: " tester@example.com ", password: "Password123!" })).resolves.toEqual({
      email: "tester@example.com",
      deliveryDestination: "t***@example.com"
    })
    await expect(confirmSignUp({ email: "tester@example.com", code: "123456" })).resolves.toBeUndefined()

    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      "https://cognito-idp.ap-northeast-1.amazonaws.com/",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({ "X-Amz-Target": "AWSCognitoIdentityProviderService.SignUp" }),
        body: expect.stringContaining("\"UserAttributes\":[{\"Name\":\"email\",\"Value\":\"tester@example.com\"}]")
      })
    )
    expect(fetchMock).toHaveBeenNthCalledWith(
      3,
      "https://cognito-idp.ap-northeast-1.amazonaws.com/",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({ "X-Amz-Target": "AWSCognitoIdentityProviderService.ConfirmSignUp" }),
        body: expect.stringContaining("\"ConfirmationCode\":\"123456\"")
      })
    )
  })

  it("maps Cognito sign-up errors to user-facing messages", async () => {
    resetRuntimeConfigForTests()
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(response({ authMode: "cognito", cognitoRegion: "ap-northeast-1", cognitoUserPoolClientId: "client-1" }))
        .mockResolvedValueOnce(response({ __type: "UsernameExistsException" }, false))
    )

    await expect(signUp({ email: "tester@example.com", password: "Password123!" })).rejects.toThrow(
      "このメールアドレスはすでに登録されています。"
    )
  })

  it("clears expired or broken stored sessions", () => {
    window.localStorage.setItem("memorag.auth.session", JSON.stringify({ email: "old@example.com", idToken: "old", expiresAt: Date.now() - 1000 }))
    expect(getStoredAuthSession()).toBeNull()
    expect(window.localStorage.getItem("memorag.auth.session")).toBeNull()

    window.sessionStorage.setItem("memorag.auth.session", "{broken")
    expect(getStoredAuthSession()).toBeNull()
    expect(window.sessionStorage.getItem("memorag.auth.session")).toBeNull()
  })

  it("supports explicit local auth mode for local E2E only", async () => {
    vi.stubEnv("VITE_AUTH_MODE", "local")

    await expect(signIn({ email: "local@example.com", password: "anything", remember: false })).resolves.toMatchObject({
      email: "local@example.com",
      idToken: "local-dev-token"
    })
    await expect(signUp({ email: "local@example.com", password: "anything" })).resolves.toEqual({ email: "local@example.com" })
    await expect(confirmSignUp({ email: "local@example.com", code: "000000" })).resolves.toBeUndefined()
    signOut()
    expect(getStoredAuthSession()).toBeNull()
  })

  it("validates required auth form inputs before calling Cognito", async () => {
    await expect(signIn({ email: "", password: "", remember: false })).rejects.toThrow("メールアドレスとパスワードを入力してください。")
    await expect(signUp({ email: "", password: "", })).rejects.toThrow("メールアドレスとパスワードを入力してください。")
    await expect(confirmSignUp({ email: "", code: "" })).rejects.toThrow("メールアドレスと確認コードを入力してください。")
    await expect(completeNewPasswordChallenge({
      challenge: { type: "NEW_PASSWORD_REQUIRED", email: "tester@example.com", session: "session", requiredAttributes: [] },
      newPassword: " ",
      remember: false
    })).rejects.toThrow("新しいパスワードを入力してください。")
  })

  it("handles uncommon Cognito challenge and malformed required attributes", async () => {
    resetRuntimeConfigForTests()
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(response({ authMode: "cognito", cognitoRegion: "ap-northeast-1", cognitoUserPoolClientId: "client-1" }))
        .mockResolvedValueOnce(response({ ChallengeName: "MFA_SETUP" }))
    )

    await expect(signIn({ email: "tester@example.com", password: "Password123!", remember: false })).rejects.toThrow("追加の認証操作が必要です: MFA_SETUP")

    resetRuntimeConfigForTests()
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(response({ authMode: "cognito", cognitoRegion: "ap-northeast-1", cognitoUserPoolClientId: "client-1" }))
        .mockResolvedValueOnce(response({ ChallengeName: "NEW_PASSWORD_REQUIRED", ChallengeParameters: { requiredAttributes: "email, phone_number" } }))
    )

    await expect(signIn({ email: "tester@example.com", password: "Password123!", remember: false })).rejects.toThrow("パスワード変更セッションを取得できませんでした。")
  })

  it("maps new password and confirmation Cognito failures", async () => {
    resetRuntimeConfigForTests()
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(response({ authMode: "cognito" }))
    )
    await expect(completeNewPasswordChallenge({
      challenge: { type: "NEW_PASSWORD_REQUIRED", email: "tester@example.com", session: "session", requiredAttributes: [] },
      newPassword: "NewPassword123!",
      remember: false
    })).rejects.toThrow("Cognito認証設定が未設定です。")

    resetRuntimeConfigForTests()
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(response({ authMode: "cognito", cognitoRegion: "ap-northeast-1", cognitoUserPoolClientId: "client-1" }))
        .mockResolvedValueOnce(response({ __type: "InvalidPasswordException" }, false))
    )
    await expect(completeNewPasswordChallenge({
      challenge: { type: "NEW_PASSWORD_REQUIRED", email: "tester@example.com", session: "session", requiredAttributes: [] },
      newPassword: "weak",
      remember: false
    })).rejects.toThrow("新しいパスワードを設定できませんでした。条件を確認して再入力してください。")

    resetRuntimeConfigForTests()
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(response({ authMode: "cognito", cognitoRegion: "ap-northeast-1", cognitoUserPoolClientId: "client-1" }))
        .mockResolvedValueOnce(response({ ChallengeName: "SMS_MFA" }))
    )
    await expect(completeNewPasswordChallenge({
      challenge: { type: "NEW_PASSWORD_REQUIRED", email: "tester@example.com", session: "session", requiredAttributes: [] },
      newPassword: "NewPassword123!",
      remember: false
    })).rejects.toThrow("追加の認証操作が必要です: SMS_MFA")

    resetRuntimeConfigForTests()
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(response({ authMode: "cognito", cognitoRegion: "ap-northeast-1", cognitoUserPoolClientId: "client-1" }))
        .mockResolvedValueOnce(response({ __type: "CodeMismatchException" }, false))
    )
    await expect(confirmSignUp({ email: "tester@example.com", code: "999999" })).rejects.toThrow("確認コードが正しくありません。")
  })

  it("supports runtime local mode and generic Cognito error messages", async () => {
    resetRuntimeConfigForTests()
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response({ authMode: "local" })))

    await expect(signIn({ email: "runtime-local@example.com", password: "anything", remember: false })).resolves.toMatchObject({
      email: "runtime-local@example.com",
      idToken: "local-dev-token"
    })
    signOut()

    resetRuntimeConfigForTests()
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response({ authMode: "local" })))
    await expect(signUp({ email: "runtime-local@example.com", password: "anything" })).resolves.toEqual({ email: "runtime-local@example.com" })

    resetRuntimeConfigForTests()
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response({ authMode: "local" })))
    await expect(confirmSignUp({ email: "runtime-local@example.com", code: "000000" })).resolves.toBeUndefined()

    resetRuntimeConfigForTests()
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(response({ authMode: "cognito", cognitoRegion: "ap-northeast-1", cognitoUserPoolClientId: "client-1" }))
        .mockResolvedValueOnce(response({ message: "service unavailable" }, false))
    )
    await expect(signUp({ email: "tester@example.com", password: "Password123!" })).rejects.toThrow("service unavailable")
  })
})
