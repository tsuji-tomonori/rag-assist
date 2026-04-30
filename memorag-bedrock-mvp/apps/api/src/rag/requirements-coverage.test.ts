import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import path from "node:path"
import test from "node:test"

const coverageByRequirement: Record<string, string[]> = {
  "テキストまたはbase64ファイルをアップロードできる。": ["text-processing.test.ts", "memorag-service.test.ts", "App.test.tsx"],
  "アップロード時に文書を抽出、チャンク化し、memory cardを生成して検索対象に登録する。": ["memorag-service.test.ts", "text-processing.test.ts"],
  "質問時にmemory card検索、clue生成、chunk検索、grounded answer生成を行う。": ["graph.test.ts", "memorag-service.test.ts"],
  "回答はアップロード済み資料の根拠に限定し、根拠不足時は回答不可を返す。": ["graph.test.ts", "prompts.test.ts"],
  "`modelId`、`embeddingModelId`、`clueModelId`、`topK`、`memoryTopK`、`minScore`、`strictGrounded`、`useMemory` をAPIパラメータから指定できる。": [
    "graph.test.ts",
    "App.test.tsx",
    "api.test.ts"
  ],
  "`includeDebug` または `debug` 指定時に、LangGraph nodeごとの実行traceを永続化して取得できる。": ["graph.test.ts", "memorag-service.test.ts", "App.test.tsx"],
  "文書を `documentId` 単位で削除でき、source、manifest、memory vectors、evidence vectorsを削除対象にする。": ["memorag-service.test.ts", "App.test.tsx"],
  "UIは資料アップロード、モデルID指定、チャット、引用表示を1画面に集約する。": ["App.test.tsx"],
  "UIはdebug modeを持ち、最新または過去のdebug traceを表示、Markdownとしてダウンロードできる。": ["App.test.tsx"],
  "ベンチマークは `/benchmark/query` APIとCLIから実行できる。": ["requirements-coverage.test.ts", "benchmark smoke via package scripts"],
  "API仕様は `/openapi.json` で取得できる。": ["requirements-coverage.test.ts"],
  "ローカルではAWSに接続せず、Bedrockモックとファイルベースvector storeで完結する。": ["graph.test.ts", "local-stores.test.ts", "text-processing.test.ts"],
  "AWSではAPI Gateway、Lambda、Bedrock、S3、S3 Vectors、CloudFrontを基本構成とする。": ["infra/test/memorag-mvp-stack.test.ts"],
  "MVPではサーバ管理を避け、固定費を抑えやすいサーバレス構成を優先する。": ["infra/test/memorag-mvp-stack.test.ts"],
  "文書本文、manifest、vector metadataはdocumentId単位で追跡できる。": ["memorag-service.test.ts", "local-stores.test.ts"],
  "debug traceは `debug-runs/<yyyy-mm-dd>/<runId>.json` として保存し、MVPの評価・原因分析に使える。": ["memorag-service.test.ts", "graph.test.ts"],
  "CloudWatch LogsはMVPコスト抑制のため1週間保持とする。": ["infra/test/memorag-mvp-stack.test.ts"],
  "S3 Vectors index dimensionはCDK context `embeddingDimensions` とAPI実行時の `EMBEDDING_DIMENSIONS` を一致させる。": [
    "infra/test/memorag-mvp-stack.test.ts"
  ],
  "月額費用は小規模検証 `$2-5`、社内MVP `$25-35`、活発なpilot `$200-250` を初期目安とし、Bedrock tokens、CloudWatch Logs、CloudFront転送量を主要変動費として監視する。": [
    "docs/REQUIREMENTS.md",
    "docs/OPERATIONS.md"
  ],
  "型チェックとビルドがCI相当の最低限の品質ゲートになる。": ["package scripts", ".github/workflows/memorag-ci.yml"],
  "`npm install` が成功する。": ["package-lock.json", "CI install step"],
  "`npm run typecheck --workspaces --if-present` が成功する。": ["package scripts", "verification command"],
  "`npm run build --workspaces --if-present` が成功する。": ["package scripts", "verification command"],
  "ローカルAPIで `GET /health`、`POST /documents`、`GET /documents`、`DELETE /documents/{documentId}`、`POST /chat`、`GET /debug-runs`、`GET /openapi.json` が成功する。": [
    "memorag-service.test.ts",
    "api.test.ts"
  ],
  "サンプルdatasetでbenchmark CLIが結果JSONLを出力する。": ["benchmark/dataset.sample.jsonl", "benchmark package script"]
}

test("all functional, non-functional, and acceptance requirements have coverage links", async () => {
  const requirementsPath = path.resolve(process.cwd(), "../../docs/REQUIREMENTS.md")
  const markdown = await readFile(requirementsPath, "utf-8")
  const bullets = [
    ...extractBullets(markdown, "## 機能要件", "## 非機能要件"),
    ...extractBullets(markdown, "## 非機能要件", "## 受け入れ条件"),
    ...extractBullets(markdown, "## 受け入れ条件", "## MVP外")
  ]

  assert.equal(bullets.length, 25)
  assert.deepEqual(
    bullets.filter((bullet) => !coverageByRequirement[bullet]),
    []
  )
  assert.deepEqual(
    Object.keys(coverageByRequirement).filter((bullet) => !bullets.includes(bullet)),
    []
  )
  assert.ok(Object.values(coverageByRequirement).every((links) => links.length > 0))
})

function extractBullets(markdown: string, startHeading: string, endHeading: string): string[] {
  const start = markdown.indexOf(startHeading)
  const end = markdown.indexOf(endHeading, start + startHeading.length)
  assert.notEqual(start, -1)
  assert.notEqual(end, -1)
  return markdown
    .slice(start + startHeading.length, end)
    .split("\n")
    .filter((line) => line.startsWith("- "))
    .map((line) => line.slice(2).trim())
}
