import { beforeEach, describe, expect, it, vi } from "vitest"
import {
  beginHostedUiSignIn,
  buildHostedUiLogoutUrl,
  clearHostedUiTransient,
  completeHostedUiCallback,
  isHostedUiCallback,
  requireHostedUiRuntimeConfig,
  resolveAuthUiMode,
  verifyHostedUiTokenResponse
} from "./hostedUiAuth.js"
import type { HostedUiRuntimeConfig } from "../../../shared/api/runtimeConfig.js"

const config: HostedUiRuntimeConfig = {
  cognitoRegion: "ap-northeast-1",
  cognitoUserPoolId: "ap-northeast-1_pool1",
  cognitoUserPoolClientId: "client1",
  cognitoHostedUiBaseUrl: "https://memorag.auth.ap-northeast-1.amazoncognito.com",
  cognitoRedirectUri: "https://app.example.com/auth/callback",
  cognitoLogoutUri: "https://app.example.com/"
}

beforeEach(() => {
  window.sessionStorage.clear()
})

describe("Hosted UI authorization code + PKCE", () => {
  it("creates an S256 authorization request without implicit grant, password, or client secret", async () => {
    const navigate = vi.fn()
    const target = await beginHostedUiSignIn(config, {
      storage: window.sessionStorage,
      crypto: globalThis.crypto,
      now: 1_000,
      navigate
    })

    expect(navigate).toHaveBeenCalledWith(target)
    const url = new URL(target)
    expect(url.origin + url.pathname).toBe(`${config.cognitoHostedUiBaseUrl}/oauth2/authorize`)
    expect(url.searchParams.get("response_type")).toBe("code")
    expect(url.searchParams.get("code_challenge_method")).toBe("S256")
    expect(url.searchParams.get("code_challenge")).toMatch(/^[A-Za-z0-9_-]{43}$/)
    expect(url.searchParams.get("state")).toMatch(/^[A-Za-z0-9_-]{43}$/)
    expect(url.searchParams.get("nonce")).toMatch(/^[A-Za-z0-9_-]{43}$/)
    expect(url.searchParams.get("redirect_uri")).toBe(config.cognitoRedirectUri)
    expect(url.searchParams.get("scope")).toBe("openid email profile")
    expect(target).not.toContain("response_type=token")
    expect(target).not.toContain("client_secret")
    expect(target).not.toContain("password")

    const transient = readTransient()
    expect(transient.expiresAt).toBe(301_000)
    expect(transient.codeVerifier).toMatch(/^[A-Za-z0-9_-]{86}$/)
  })

  it("consumes state once, exchanges the code with verifier, and validates issuer/audience/nonce/client binding", async () => {
    await beginHostedUiSignIn(config, { storage: window.sessionStorage, navigate: vi.fn() })
    const transient = readTransient()
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({
        id_token: "id-token",
        access_token: "access-token",
        refresh_token: "refresh-token",
        expires_in: 3600,
        token_type: "Bearer"
      })
    })
    const expiresAtSeconds = Math.floor(Date.now() / 1000) + 3600
    const verifyJwt = vi
      .fn()
      .mockResolvedValueOnce({
        token_use: "id",
        nonce: transient.nonce,
        email: "tester@example.com",
        exp: expiresAtSeconds,
        "cognito:groups": ["CHAT_USER"]
      })
      .mockResolvedValueOnce({
        token_use: "access",
        client_id: config.cognitoUserPoolClientId,
        exp: expiresAtSeconds
      })

    const callbackUrl = `${config.cognitoRedirectUri}?code=authorization-code&state=${encodeURIComponent(transient.state)}`
    await expect(completeHostedUiCallback(config, callbackUrl, {
      storage: window.sessionStorage,
      fetch: fetchMock as typeof fetch,
      verifyJwt
    })).resolves.toEqual({
      email: "tester@example.com",
      idToken: "id-token",
      accessToken: "access-token",
      refreshToken: "refresh-token",
      expiresAt: expiresAtSeconds * 1000,
      cognitoGroups: ["CHAT_USER"]
    })

    expect(window.sessionStorage.length).toBe(0)
    expect(fetchMock).toHaveBeenCalledWith(`${config.cognitoHostedUiBaseUrl}/oauth2/token`, expect.objectContaining({
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: expect.stringContaining(`code_verifier=${encodeURIComponent(transient.codeVerifier)}`)
    }))
    const tokenRequest = String(fetchMock.mock.calls[0]?.[1]?.body)
    expect(tokenRequest).toContain("grant_type=authorization_code")
    expect(tokenRequest).not.toContain("client_secret")
    expect(verifyJwt).toHaveBeenNthCalledWith(1, "id-token", {
      issuer: "https://cognito-idp.ap-northeast-1.amazonaws.com/ap-northeast-1_pool1",
      audience: "client1"
    })
    expect(verifyJwt).toHaveBeenNthCalledWith(2, "access-token", {
      issuer: "https://cognito-idp.ap-northeast-1.amazonaws.com/ap-northeast-1_pool1"
    })

    await expect(completeHostedUiCallback(config, callbackUrl, {
      storage: window.sessionStorage,
      fetch: fetchMock as typeof fetch,
      verifyJwt
    })).rejects.toThrow("すでに使用されています")
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it("clears transient state before rejecting mismatch, expiry, duplicate params, and Cognito errors", async () => {
    const cases = [
      (transient: ReturnType<typeof readTransient>) => `${config.cognitoRedirectUri}?code=code&state=wrong-${transient.state}`,
      (transient: ReturnType<typeof readTransient>) => `${config.cognitoRedirectUri}?code=code&state=${transient.state}&state=duplicate`,
      (transient: ReturnType<typeof readTransient>) => `${config.cognitoRedirectUri}?error=access_denied&state=${transient.state}`,
      (transient: ReturnType<typeof readTransient>) => `${config.cognitoRedirectUri}?code=code&error=access_denied&state=${transient.state}`
    ]

    for (const callbackUrl of cases) {
      await beginHostedUiSignIn(config, { storage: window.sessionStorage, navigate: vi.fn() })
      const transient = readTransient()
      await expect(completeHostedUiCallback(config, callbackUrl(transient), {
        storage: window.sessionStorage,
        fetch: vi.fn() as typeof fetch
      })).rejects.toThrow()
      expect(window.sessionStorage.length).toBe(0)
    }

    await beginHostedUiSignIn(config, { storage: window.sessionStorage, now: 1_000, navigate: vi.fn() })
    const expired = readTransient()
    await expect(completeHostedUiCallback(
      config,
      `${config.cognitoRedirectUri}?code=code&state=${expired.state}`,
      { storage: window.sessionStorage, now: expired.expiresAt }
    )).rejects.toThrow("有効期限")
    expect(window.sessionStorage.length).toBe(0)
  })

  it("rejects nonce, token use, client binding, and expiry mismatches", async () => {
    const validBody = {
      id_token: "id-token",
      access_token: "access-token",
      token_type: "Bearer"
    }
    const future = Math.floor(Date.now() / 1000) + 3600

    await expect(verifyHostedUiTokenResponse(validBody, config, "expected", vi
      .fn()
      .mockResolvedValueOnce({ token_use: "id", nonce: "wrong", email: "tester@example.com", exp: future })
    )).rejects.toThrow("nonce")

    await expect(verifyHostedUiTokenResponse(validBody, config, "expected", vi
      .fn()
      .mockResolvedValueOnce({ token_use: "id", nonce: "expected", email: "tester@example.com", exp: future })
      .mockResolvedValueOnce({ token_use: "access", client_id: "other-client", exp: future })
    )).rejects.toThrow("client binding")

    await expect(verifyHostedUiTokenResponse(validBody, config, "expected", vi
      .fn()
      .mockResolvedValueOnce({ token_use: "id", nonce: "expected", email: "tester@example.com", exp: 1 })
    )).rejects.toThrow("有効期限")
  })

  it("makes Hosted UI primary in production and fails closed when its exact config is absent", () => {
    const runtimeConfig = {
      authMode: "cognito" as const,
      ...config
    }
    expect(resolveAuthUiMode({
      config: runtimeConfig,
      currentOrigin: "https://app.example.com",
      isProduction: true,
      explicitAuthMode: "local"
    })).toBe("hostedUi")
    expect(resolveAuthUiMode({
      config: { authMode: "cognito" },
      currentOrigin: "https://app.example.com",
      isProduction: true,
      explicitAuthMode: "local"
    })).toBe("unavailable")
    expect(resolveAuthUiMode({
      config: { ...runtimeConfig, cognitoRedirectUri: "https://evil.example.com/auth/callback" },
      currentOrigin: "https://app.example.com",
      isProduction: true
    })).toBe("unavailable")
    expect(resolveAuthUiMode({
      config: { authMode: "local" },
      currentOrigin: "http://localhost:5173",
      isProduction: false,
      explicitAuthMode: "local"
    })).toBe("credentials")
  })

  it("builds an exact Hosted UI logout redirect without wildcard or secret parameters", () => {
    const logout = new URL(buildHostedUiLogoutUrl(config))
    expect(logout.origin + logout.pathname).toBe(`${config.cognitoHostedUiBaseUrl}/logout`)
    expect(logout.searchParams.get("client_id")).toBe(config.cognitoUserPoolClientId)
    expect(logout.searchParams.get("logout_uri")).toBe(config.cognitoLogoutUri)
    expect(logout.toString()).not.toContain("client_secret")
  })

  it("recognizes only the exact callback and rejects a different callback path after one-time consume", async () => {
    const exactCallback = `${config.cognitoRedirectUri}?code=code&state=state`
    expect(isHostedUiCallback(config, exactCallback)).toBe(true)
    expect(isHostedUiCallback(config, "https://app.example.com/other?code=code")).toBe(false)
    expect(isHostedUiCallback(config, "not-a-url")).toBe(false)

    await beginHostedUiSignIn(config, { storage: window.sessionStorage, navigate: vi.fn() })
    const transient = readTransient()
    await expect(completeHostedUiCallback(
      config,
      `https://app.example.com/other?code=code&state=${transient.state}`,
      { storage: window.sessionStorage }
    )).rejects.toThrow("callback URL")
    expect(window.sessionStorage.length).toBe(0)
  })

  it("clears malformed transient data and requires a complete exact runtime config", async () => {
    await beginHostedUiSignIn(config, { storage: window.sessionStorage, navigate: vi.fn() })
    const key = window.sessionStorage.key(0)
    expect(key).toBeTruthy()
    window.sessionStorage.setItem(key ?? "", "{broken")
    await expect(completeHostedUiCallback(config, `${config.cognitoRedirectUri}?code=code&state=state`, {
      storage: window.sessionStorage
    })).rejects.toThrow("一時情報")
    expect(window.sessionStorage.length).toBe(0)

    expect(requireHostedUiRuntimeConfig({ authMode: "cognito", ...config }, "https://app.example.com")).toEqual(config)
    expect(() => requireHostedUiRuntimeConfig({ authMode: "cognito" }, "https://app.example.com")).toThrow("未設定または不正")

    await beginHostedUiSignIn(config, { storage: window.sessionStorage, navigate: vi.fn() })
    clearHostedUiTransient(window.sessionStorage)
    expect(window.sessionStorage.length).toBe(0)
  })
})

function readTransient(): { state: string; nonce: string; codeVerifier: string; expiresAt: number } {
  expect(window.sessionStorage.length).toBe(1)
  const key = window.sessionStorage.key(0)
  expect(key).toBeTruthy()
  return JSON.parse(window.sessionStorage.getItem(key ?? "") ?? "{}")
}
