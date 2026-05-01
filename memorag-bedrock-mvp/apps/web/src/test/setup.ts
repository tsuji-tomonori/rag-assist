import "@testing-library/jest-dom/vitest"
import { cleanup } from "@testing-library/react"
import { afterEach, vi } from "vitest"
import { resetRuntimeConfigForTests, setAuthTokenProvider } from "../api.js"

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  vi.unstubAllEnvs()
  window.localStorage.clear()
  window.sessionStorage.clear()
  setAuthTokenProvider(undefined)
  resetRuntimeConfigForTests()
})
