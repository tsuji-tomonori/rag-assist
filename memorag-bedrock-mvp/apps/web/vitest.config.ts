import react from "@vitejs/plugin-react"
import { defineConfig } from "vitest/config"

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    setupFiles: ["src/test/setup.ts"],
    include: ["src/**/*.test.{ts,tsx}"],
    exclude: ["e2e/**", "node_modules/**", "dist/**"],
    testTimeout: 10000,
    coverage: {
      provider: "v8",
      reporter: ["text", "json-summary"],
      all: true,
      include: ["src/**/*.{ts,tsx}"],
      exclude: ["src/main.tsx", "src/test/**"],
      thresholds: {
        statements: 90,
        branches: 85,
        functions: 83,
        lines: 90
      }
    }
  }
})
