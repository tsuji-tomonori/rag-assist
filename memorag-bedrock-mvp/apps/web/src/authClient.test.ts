import { describe, expect, it, vi } from "vitest"
import { listDocuments, resetRuntimeConfigForTests } from "./api.js"
import { completeNewPasswordChallenge, getStoredAuthSession, signIn, signOut } from "./authClient.js"

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
    const fetchMock = vi.fn((url: RequestInfo | URL, init?: RequestInit) => {
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
    signOut()
    expect(getStoredAuthSession()).toBeNull()
  })
})
