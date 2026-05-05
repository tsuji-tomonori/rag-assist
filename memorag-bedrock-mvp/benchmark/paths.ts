import { existsSync } from "node:fs"
import path from "node:path"

export function resolveExistingPath(input: string, bases: string[]): string {
  if (path.isAbsolute(input)) return input
  for (const base of bases) {
    const candidate = path.resolve(base, input)
    if (existsSync(candidate)) return candidate
  }
  return path.resolve(process.cwd(), input)
}

export function resolveOutputPath(input: string, baseDir: string): string {
  if (path.isAbsolute(input)) return input
  return path.resolve(baseDir, input)
}
