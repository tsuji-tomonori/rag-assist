import { mkdir, readFile, writeFile } from "node:fs/promises"
import path from "node:path"
import type { ChatRun } from "../types.js"
import type { ChatRunStore, CreateChatRunInput, UpdateChatRunInput } from "./chat-run-store.js"

export class LocalChatRunStore implements ChatRunStore {
  constructor(private readonly dataDir: string) {}

  async create(input: CreateChatRunInput): Promise<ChatRun> {
    await this.write(input)
    return input
  }

  async get(runId: string): Promise<ChatRun | undefined> {
    try {
      return JSON.parse(await readFile(this.runPath(runId), "utf-8")) as ChatRun
    } catch (err) {
      if (err && typeof err === "object" && "code" in err && err.code === "ENOENT") return undefined
      throw err
    }
  }

  async update(runId: string, input: UpdateChatRunInput): Promise<ChatRun> {
    const current = await this.get(runId)
    if (!current) throw new Error("Chat run not found")
    const updated = { ...current, ...input, updatedAt: input.updatedAt ?? new Date().toISOString() }
    await this.write(updated)
    return updated
  }

  private async write(run: ChatRun): Promise<void> {
    await mkdir(this.runDir(), { recursive: true })
    await writeFile(this.runPath(run.runId), `${JSON.stringify(run, null, 2)}\n`, "utf-8")
  }

  private runDir(): string {
    return path.join(this.dataDir, "chat-runs")
  }

  private runPath(runId: string): string {
    return path.join(this.runDir(), `${runId.replace(/[^a-zA-Z0-9._-]/g, "_")}.json`)
  }
}
