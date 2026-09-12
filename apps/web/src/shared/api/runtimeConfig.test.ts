import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import {
  getApiBaseUrl,
  getRuntimeConfig,
  joinApiPath,
  resetRuntimeConfigForTests,
  resolveApiBaseUrl,
  resolveHostedUiRuntimeConfig
} from "./runtimeConfig.js"

describe("SPA REST runtime config", () => {
  beforeEach(() => {
    resetRuntimeConfigForTests()
    vi.unstubAllEnvs()
  })

  afterEach(() => {
    resetRuntimeConfigForTests()
    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
  })

  it("uses the deployed same-origin /api config and joins request paths exactly once", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({ apiBaseUrl: "/api/" })
    }))

    await expect(getApiBaseUrl()).resolves.toBe("/api")
    expect(joinApiPath("/api/", "/documents")).toBe("/api/documents")
    expect(joinApiPath("/api", "//rpc")).toBe("/api/rpc")
    expect(joinApiPath("/api", "/chat-runs/run-1/events")).toBe("/api/chat-runs/run-1/events")
  })

  it("preserves an explicit Vite/local absolute API override", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: vi.fn().mockResolvedValue({}) }))
    vi.stubEnv("VITE_API_BASE_URL", " http://localhost:8787/ ")

    await expect(getApiBaseUrl()).resolves.toBe("http://localhost:8787")
    expect(joinApiPath(await getApiBaseUrl(), "/documents")).toBe("http://localhost:8787/documents")
  })

  it("keeps file auth settings while a Vite API override takes precedence", async () => {
    vi.stubEnv("VITE_API_BASE_URL", "https://preview-api.example.test/")
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({
        apiBaseUrl: "/api",
        authMode: "cognito",
        cognitoRegion: "ap-northeast-1"
      })
    }))

    await expect(getRuntimeConfig()).resolves.toEqual(expect.objectContaining({
      apiBaseUrl: "https://preview-api.example.test",
      authMode: "cognito",
      cognitoRegion: "ap-northeast-1"
    }))
    await expect(getApiBaseUrl()).resolves.toBe("https://preview-api.example.test")
  })

  it("falls back to the explicit local API default when config loading fails", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("config unavailable")))

    await expect(getApiBaseUrl()).resolves.toBe("http://localhost:8787")
  })

  it("ignores malformed file values in development instead of constructing a false endpoint", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({ apiBaseUrl: { origin: "https://api.example.test" } })
    }))

    await expect(getApiBaseUrl()).resolves.toBe("http://localhost:8787")
  })

  it("fails closed to /api for every production cross-origin or malformed override", () => {
    const productionCases = [
      { viteApiBaseUrl: "https://abc.execute-api.ap-northeast-1.amazonaws.com/prod", fileApiBaseUrl: "/api" },
      { viteApiBaseUrl: "https://api.attacker.example", fileApiBaseUrl: "https://api.example.test" },
      { viteApiBaseUrl: undefined, fileApiBaseUrl: "http://localhost:8787" },
      { viteApiBaseUrl: undefined, fileApiBaseUrl: 42 },
      { viteApiBaseUrl: "not-a-url", fileApiBaseUrl: undefined }
    ]

    for (const configured of productionCases) {
      expect(resolveApiBaseUrl({ ...configured, isProduction: true })).toBe("/api")
    }
  })

  it("accepts only the generated Cognito domain and exact same-origin callback/logout URLs", () => {
    const hostedConfig = {
      cognitoRegion: "ap-northeast-1",
      cognitoUserPoolId: "ap-northeast-1_pool1",
      cognitoUserPoolClientId: "client1",
      cognitoHostedUiBaseUrl: "https://memorag.auth.ap-northeast-1.amazoncognito.com",
      cognitoRedirectUri: "https://app.example.com/auth/callback",
      cognitoLogoutUri: "https://app.example.com/"
    }
    expect(resolveHostedUiRuntimeConfig(hostedConfig, "https://app.example.com")).toEqual(hostedConfig)

    for (const invalid of [
      { cognitoHostedUiBaseUrl: "https://evil.example.com" },
      { cognitoHostedUiBaseUrl: "https://nested.memorag.auth.ap-northeast-1.amazoncognito.com" },
      { cognitoHostedUiBaseUrl: "http://memorag.auth.ap-northeast-1.amazoncognito.com" },
      { cognitoRedirectUri: "https://evil.example.com/auth/callback" },
      { cognitoRedirectUri: "https://app.example.com/auth/callback/extra" },
      { cognitoLogoutUri: "https://app.example.com/after-logout" },
      { cognitoUserPoolId: "other-region_pool1" },
      { cognitoUserPoolClientId: "client with spaces" }
    ]) {
      expect(resolveHostedUiRuntimeConfig({ ...hostedConfig, ...invalid }, "https://app.example.com")).toBeUndefined()
    }
    expect(resolveHostedUiRuntimeConfig({
      ...hostedConfig,
      cognitoRedirectUri: "http://app.example.com/auth/callback",
      cognitoLogoutUri: "http://app.example.com/"
    }, "http://app.example.com")).toBeUndefined()
  })
})
