import "@testing-library/jest-dom/vitest"
import { cleanup } from "@testing-library/react"
import { afterEach, vi } from "vitest"
import { setAuthTokenProvider } from "../shared/api/http.js"
import { resetRuntimeConfigForTests } from "../shared/api/runtimeConfig.js"

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  vi.unstubAllEnvs()
  window.localStorage.clear()
  window.sessionStorage.clear()
  setAuthTokenProvider(undefined)
  resetRuntimeConfigForTests()
})
