export type JsonObject = Record<string, unknown>

export type OpenApiDocument = {
  openapi?: string
  info?: {
    title?: string
    version?: string
    description?: string
  }
  paths?: Record<string, Record<string, OperationObject>>
  components?: {
    schemas?: Record<string, SchemaObject>
    securitySchemes?: Record<string, unknown>
  }
}

export type OperationObject = {
  summary?: string
  description?: string
  operationId?: string
  tags?: string[]
  security?: Array<Record<string, string[]>>
  parameters?: ParameterObject[]
  requestBody?: RequestBodyObject
  responses?: Record<string, ResponseObject>
  "x-memorag-authorization"?: RouteAuthorizationMetadataObject
}

export type RouteAuthorizationMetadataObject = {
  mode?: string
  requiredPermissions?: string[]
  conditionalPermissions?: string[]
  allowedRoles?: string[]
  deniedRoles?: string[]
  conditionalDeniedRoles?: string[]
  notes?: string[]
  errors?: Array<{
    status?: number
    when?: string
    body?: Record<string, unknown>
  }>
}

export type ParameterObject = {
  name?: string
  in?: string
  required?: boolean
  description?: string
  schema?: SchemaObject
}

export type RequestBodyObject = {
  required?: boolean
  description?: string
  content?: Record<string, MediaTypeObject>
}

export type ResponseObject = {
  description?: string
  content?: Record<string, MediaTypeObject>
}

export type MediaTypeObject = {
  schema?: SchemaObject
}

export type SchemaObject = JsonObject & {
  $ref?: string
  type?: string | string[]
  format?: string
  description?: string
  enum?: unknown[]
  properties?: Record<string, SchemaObject>
  required?: string[]
  items?: SchemaObject
  oneOf?: SchemaObject[]
  anyOf?: SchemaObject[]
  allOf?: SchemaObject[]
  nullable?: boolean
  minimum?: number
  maximum?: number
  minLength?: number
  maxLength?: number
  minItems?: number
  maxItems?: number
}

export type FieldRow = {
  name: string
  type: string
  required: boolean
  description: string
  constraints: string
}

export type ParameterGroup = "header" | "path" | "query" | "cookie"

const httpMethods = new Set(["get", "put", "post", "delete", "patch", "options", "head", "trace"])
const japanesePattern = /[\u3040-\u30ff\u3400-\u9fff]/

const operationDocs: Record<string, { summary: string; description: string }> = {
  "GET /health": {
    summary: "ヘルスチェックを取得する",
    description: "API プロセスが応答可能かを確認するため、サービス状態を返します。"
  },
  "GET /me": {
    summary: "ログインユーザー情報を取得する",
    description: "認証済みユーザーの ID、ロール、有効 permission を返します。"
  },
  "POST /admin/users": {
    summary: "管理対象ユーザーを作成する",
    description: "管理者が Cognito と管理台帳に新しいユーザーを作成します。"
  },
  "GET /admin/users": {
    summary: "管理対象ユーザー一覧を取得する",
    description: "Cognito と管理台帳を照合し、管理画面で扱うユーザー一覧を返します。"
  },
  "GET /admin/audit-log": {
    summary: "管理操作履歴を取得する",
    description: "ユーザー管理や権限管理に関する監査ログを取得します。"
  },
  "POST /admin/users/{userId}/roles": {
    summary: "ユーザーのロールを更新する",
    description: "指定した管理対象ユーザーに付与するアプリケーションロールを更新します。"
  },
  "POST /admin/users/{userId}/suspend": {
    summary: "ユーザーを停止する",
    description: "指定したユーザーを停止状態にし、以後の利用を制限します。"
  },
  "POST /admin/users/{userId}/unsuspend": {
    summary: "ユーザー停止を解除する",
    description: "指定した停止中ユーザーを再開状態に戻します。"
  },
  "DELETE /admin/users/{userId}": {
    summary: "ユーザーを削除する",
    description: "指定した管理対象ユーザーを削除し、管理台帳へ反映します。"
  },
  "GET /admin/roles": {
    summary: "利用可能なロール一覧を取得する",
    description: "管理画面で付与可能なロールと permission の一覧を返します。"
  },
  "GET /admin/aliases": {
    summary: "検索 alias 一覧を取得する",
    description: "RAG 検索で利用する alias 定義と公開状態を取得します。"
  },
  "POST /admin/aliases": {
    summary: "検索 alias draft を作成する",
    description: "検索語の展開に使う alias の draft 定義を作成します。"
  },
  "POST /admin/aliases/{aliasId}/update": {
    summary: "検索 alias draft を更新する",
    description: "指定した alias draft の語句、展開語、状態を更新します。"
  },
  "POST /admin/aliases/{aliasId}/review": {
    summary: "検索 alias をレビューする",
    description: "指定した alias draft をレビュー済み状態へ進めます。"
  },
  "POST /admin/aliases/{aliasId}/disable": {
    summary: "検索 alias を無効化する",
    description: "指定した alias を検索展開から外すため無効化します。"
  },
  "POST /admin/aliases/publish": {
    summary: "検索 alias を公開する",
    description: "レビュー済み alias を公開し、検索処理で参照できる状態にします。"
  },
  "GET /admin/aliases/audit-log": {
    summary: "検索 alias 監査ログを取得する",
    description: "alias 作成、更新、レビュー、公開に関する監査ログを取得します。"
  },
  "GET /admin/usage": {
    summary: "利用状況を取得する",
    description: "全ユーザーまたは指定条件に一致する利用状況の集計を返します。"
  },
  "GET /admin/costs": {
    summary: "概算コストを取得する",
    description: "モデル利用や処理量に基づく概算コストの監査向け summary を返します。"
  },
  "GET /documents": {
    summary: "登録文書一覧を取得する",
    description: "ログインユーザーが参照できる登録済み文書の一覧を返します。"
  },
  "POST /documents": {
    summary: "文書を登録する",
    description: "テキストまたはファイル内容を登録し、RAG 検索用の文書として取り込みます。"
  },
  "POST /documents/uploads": {
    summary: "文書アップロード URL を作成する",
    description: "S3 またはローカル開発用のアップロードセッションと送信先を作成します。"
  },
  "POST /documents/uploads/{uploadId}/content": {
    summary: "文書アップロード内容を保存する",
    description: "ローカル開発用アップロードセッションに文書バイト列を保存します。"
  },
  "POST /documents/uploads/{uploadId}/ingest": {
    summary: "アップロード済み文書を取り込む",
    description: "アップロードセッションの文書を同期的に解析し、RAG 利用可能な文書として登録します。"
  },
  "POST /document-ingest-runs": {
    summary: "非同期文書取り込みを開始する",
    description: "アップロード済み文書の非同期取り込み run を開始し、進捗参照用 ID を返します。"
  },
  "GET /document-ingest-runs/{runId}": {
    summary: "文書取り込み run を取得する",
    description: "指定した非同期文書取り込み run の状態と結果を返します。"
  },
  "GET /document-ingest-runs/{runId}/events": {
    summary: "文書取り込みイベントを購読する",
    description: "指定した文書取り込み run の進捗イベントを Server-Sent Events で返します。"
  },
  "POST /documents/{documentId}/reindex": {
    summary: "文書を再インデックスする",
    description: "指定した文書を現在設定の embedding / memory モデルで再処理します。"
  },
  "GET /documents/reindex-migrations": {
    summary: "再インデックス移行一覧を取得する",
    description: "blue-green 再インデックスの migration 状態と履歴を取得します。"
  },
  "POST /documents/{documentId}/reindex/stage": {
    summary: "再インデックスを stage する",
    description: "指定文書の staged document を作成し、cutover 前に検証できる状態にします。"
  },
  "POST /documents/reindex-migrations/{migrationId}/cutover": {
    summary: "再インデックス結果へ切り替える",
    description: "指定 migration の staged document を active document として切り替えます。"
  },
  "POST /documents/reindex-migrations/{migrationId}/rollback": {
    summary: "再インデックス切替を戻す",
    description: "指定 migration の cutover 後状態から元の active document へ戻します。"
  },
  "DELETE /documents/{documentId}": {
    summary: "文書を削除する",
    description: "指定した文書と検索用データを削除します。"
  },
  "GET /document-groups": {
    summary: "文書グループ一覧を取得する",
    description: "ログインユーザーが参照または管理できる文書グループの一覧を返します。"
  },
  "POST /document-groups": {
    summary: "文書グループを作成する",
    description: "文書をスコープごとに整理するための文書グループを作成します。"
  },
  "POST /document-groups/{groupId}/share": {
    summary: "文書グループ共有設定を更新する",
    description: "指定した文書グループの共有先や権限範囲を更新します。"
  },
  "POST /chat": {
    summary: "同期チャット回答を生成する",
    description: "登録済み文書を根拠に RAG 回答、回答不能、確認質問のいずれかを同期的に返します。"
  },
  "POST /chat-runs": {
    summary: "非同期チャット run を開始する",
    description: "長時間 RAG 処理の進捗を追跡できる非同期チャット run を作成します。"
  },
  "GET /chat-runs/{runId}/events": {
    summary: "チャット run イベントを購読する",
    description: "指定したチャット run の進捗と最終回答を Server-Sent Events で返します。"
  },
  "POST /search": {
    summary: "ハイブリッド検索を実行する",
    description: "lexical / vector / RRF を組み合わせた検索結果と診断情報を返します。"
  },
  "POST /questions": {
    summary: "担当者問い合わせを作成する",
    description: "回答不能または確認が必要な内容を担当者へ引き継ぐ問い合わせとして登録します。"
  },
  "GET /questions": {
    summary: "担当者問い合わせ一覧を取得する",
    description: "担当者または作成者が参照可能な問い合わせ一覧を取得します。"
  },
  "GET /questions/{questionId}": {
    summary: "担当者問い合わせ詳細を取得する",
    description: "指定した問い合わせの本文、回答、状態を取得します。"
  },
  "POST /questions/{questionId}/answer": {
    summary: "担当者回答を登録する",
    description: "指定した問い合わせに担当者回答を登録します。"
  },
  "POST /questions/{questionId}/resolve": {
    summary: "問い合わせを解決済みにする",
    description: "回答済み問い合わせを解決済み状態へ更新します。"
  },
  "GET /conversation-history": {
    summary: "会話履歴一覧を取得する",
    description: "ログインユーザー自身の保存済み会話履歴を取得します。"
  },
  "POST /conversation-history": {
    summary: "会話履歴を保存する",
    description: "会話履歴 item を保存し、お気に入り状態などの表示情報を更新します。"
  },
  "DELETE /conversation-history/{id}": {
    summary: "会話履歴を削除する",
    description: "ログインユーザー自身の指定した会話履歴 item を削除します。"
  },
  "GET /debug-runs": {
    summary: "debug trace 一覧を取得する",
    description: "永続化された RAG debug trace の一覧を管理者向けに返します。"
  },
  "GET /debug-runs/{runId}": {
    summary: "debug trace 詳細を取得する",
    description: "指定した RAG debug trace の詳細ステップと判断情報を返します。"
  },
  "POST /debug-runs/{runId}/download": {
    summary: "debug trace ダウンロード URL を作成する",
    description: "指定した debug trace JSON を取得するための署名付き URL を作成します。"
  },
  "POST /benchmark/query": {
    summary: "ベンチマーク質問を実行する",
    description: "ベンチマーク runner が `/chat` 相当の RAG 処理を実行し、評価用の詳細情報を取得します。"
  },
  "POST /benchmark/search": {
    summary: "検索ベンチマークを実行する",
    description: "ベンチマーク runner が `/search` 相当の検索処理を実行し、検索評価用の結果を取得します。"
  },
  "GET /benchmark-suites": {
    summary: "ベンチマーク suite 一覧を取得する",
    description: "非同期 benchmark run で選択可能な suite 定義を取得します。"
  },
  "POST /benchmark-runs": {
    summary: "非同期 benchmark run を開始する",
    description: "Step Functions / CodeBuild runner による非同期 benchmark run を起動します。"
  },
  "GET /benchmark-runs": {
    summary: "benchmark run 一覧を取得する",
    description: "保存済み benchmark run の履歴一覧を取得します。"
  },
  "GET /benchmark-runs/{runId}": {
    summary: "benchmark run 詳細を取得する",
    description: "指定した benchmark run の状態、設定、指標、artifact 情報を返します。"
  },
  "POST /benchmark-runs/{runId}/cancel": {
    summary: "benchmark run をキャンセルする",
    description: "実行中または待機中の benchmark run をキャンセルします。"
  },
  "POST /benchmark-runs/{runId}/download": {
    summary: "benchmark artifact ダウンロード URL を作成する",
    description: "指定した benchmark report / summary / results / logs の署名付き URL を作成します。"
  }
}

const fieldDescriptions: Record<string, string> = {
  id: "リソースを一意に識別する ID。",
  userId: "対象ユーザーを一意に識別する ID。",
  documentId: "対象文書を一意に識別する ID。",
  uploadId: "文書アップロードセッションを識別する ID。",
  runId: "非同期 run または debug trace を識別する ID。",
  migrationId: "再インデックス migration を識別する ID。",
  aliasId: "検索 alias を識別する ID。",
  questionId: "担当者問い合わせを識別する ID。",
  title: "表示や一覧で利用するタイトル。",
  name: "表示名または項目名。",
  displayName: "画面に表示するユーザー名。",
  email: "ユーザーのメールアドレス。",
  status: "現在の処理状態または管理状態。",
  createdAt: "レコードを作成した日時。",
  updatedAt: "レコードを最後に更新した日時。",
  startedAt: "処理を開始した日時。",
  completedAt: "処理が完了した日時。",
  expiresAt: "URL または一時リソースの有効期限。",
  fileName: "登録またはアップロードするファイル名。",
  contentType: "ファイルまたは HTTP body の MIME type。",
  text: "文書本文またはチャンク本文。",
  question: "ユーザーまたは benchmark dataset から渡される質問文。",
  answer: "RAG または担当者による回答本文。",
  response: "チャット API が返す回答または拒否文。",
  responseType: "回答、回答不能、確認質問などのレスポンス種別。",
  isAnswerable: "資料から回答可能と判断されたかどうか。",
  needsClarification: "回答前に対象確認が必要かどうか。",
  citations: "回答根拠として提示する引用情報。",
  retrieved: "検索直後の候補チャンク一覧。",
  finalEvidence: "回答生成へ渡した最終根拠候補。",
  debug: "調査用の内部処理情報。",
  includeDebug: "レスポンスに debug 情報を含めるかどうか。",
  modelId: "回答生成に利用する Bedrock model ID。",
  embeddingModelId: "embedding 生成に利用する model ID。",
  memoryModelId: "memory card 生成に利用する model ID。",
  topK: "検索で取得する上位件数。",
  memoryTopK: "memory 検索で取得する上位件数。",
  minScore: "検索結果として採用する最小 score。",
  score: "検索または評価で算出した関連度 score。",
  groups: "ユーザーが所属する Cognito group または検証用 group。",
  roles: "ユーザーに付与するアプリケーションロール。",
  permissions: "ログインユーザーに有効な permission 一覧。",
  url: "アクセス先または署名付き URL。",
  method: "利用する HTTP メソッド。",
  headers: "アップロードや API 呼び出しに付与する HTTP header。",
  fields: "フォーム送信に必要な field 一覧。",
  key: "object store または artifact の key。",
  bucket: "S3 bucket 名。",
  artifact: "ダウンロード対象の artifact 種別。",
  summary: "処理結果や debug step の要約。",
  details: "補足情報または検証エラー詳細。",
  error: "エラー内容を表すメッセージ。",
  message: "ユーザーまたは API 向けのメッセージ。",
  reason: "判断や失敗の理由。",
  category: "問い合わせや文書の分類。",
  type: "データやイベントの種別。",
  path: "API path または参照先 path。",
  query: "検索や benchmark に利用する query。",
  filters: "検索対象を絞り込む条件。",
  diagnostics: "検索や benchmark の診断情報。",
  metrics: "評価や benchmark の指標値。",
  thresholds: "benchmark 判定に使う閾値。",
  suiteId: "benchmark suite を識別する ID。",
  mode: "benchmark 実行モード。",
  runner: "benchmark を実行する runner 種別。",
  concurrency: "同時実行数。",
  eventsPath: "SSE イベントを購読する API path。",
  items: "一覧レスポンスに含まれる item 配列。",
  documents: "文書一覧。",
  questions: "問い合わせ一覧。",
  runs: "run 一覧。",
  suites: "benchmark suite 一覧。",
  aliases: "検索 alias 一覧。",
  auditLog: "監査ログ一覧。",
  usage: "利用状況の集計。",
  costs: "概算コスト情報。"
}

const responseDescriptions: Record<string, string> = {
  "200": "リクエストは成功し、レスポンス body に結果を返します。",
  "201": "リソース作成に成功しました。",
  "202": "非同期処理の受付に成功しました。",
  "204": "リクエストは成功し、レスポンス body はありません。",
  "400": "リクエスト形式または入力値が不正です。",
  "401": "認証が必要です。",
  "403": "対象操作を実行する権限がありません。",
  "404": "指定したリソースが見つかりません。",
  "409": "現在のリソース状態と要求された操作が競合しています。",
  "500": "サーバー内部で処理エラーが発生しました。"
}

export function isHttpMethod(method: string): boolean {
  return httpMethods.has(method)
}

export function operationKey(method: string, path: string): string {
  return `${method.toUpperCase()} ${path}`
}

export function cloneOpenApiDocument(api: OpenApiDocument): OpenApiDocument {
  return JSON.parse(JSON.stringify(api)) as OpenApiDocument
}

export function enrichOpenApiDocument(input: OpenApiDocument): OpenApiDocument {
  const api = cloneOpenApiDocument(input)

  for (const [name, schema] of Object.entries(api.components?.schemas ?? {})) {
    applySchemaDescriptions(api, schema, name)
  }

  for (const [path, pathItem] of Object.entries(api.paths ?? {})) {
    for (const [method, operation] of Object.entries(pathItem)) {
      if (!isHttpMethod(method)) continue
      const docs = operationDocs[operationKey(method, path)]
      if (docs) {
        operation.summary = docs.summary
        operation.description = docs.description
      }
      if (requiresAuthorization(path)) {
        operation.parameters = [
          authorizationHeaderParameter(),
          ...(operation.parameters ?? []).filter((parameter) => !(parameter.in === "header" && parameter.name?.toLowerCase() === "authorization"))
        ]
      }
      for (const parameter of operation.parameters ?? []) {
        parameter.description = parameter.description && hasJapanese(parameter.description)
          ? parameter.description
          : parameterDescription(parameter)
        if (parameter.schema) applySchemaDescriptions(api, parameter.schema, parameter.name ?? "parameter")
      }
      if (operation.requestBody) {
        operation.requestBody.description ??= "リクエスト body に指定する data。"
        for (const media of Object.values(operation.requestBody.content ?? {})) {
          if (media.schema) applySchemaDescriptions(api, media.schema, "data")
        }
      }
      for (const [status, response] of Object.entries(operation.responses ?? {})) {
        response.description = responseDescriptions[status] ?? response.description ?? "レスポンスを返します。"
        for (const media of Object.values(response.content ?? {})) {
          if (media.schema) applySchemaDescriptions(api, media.schema, "response")
        }
      }
    }
  }
  return api
}

export function validateOpenApiDocument(api: OpenApiDocument): string[] {
  const errors: string[] = []

  for (const [path, pathItem] of Object.entries(api.paths ?? {})) {
    for (const [method, operation] of Object.entries(pathItem)) {
      if (!isHttpMethod(method)) continue
      const key = operationKey(method, path)
      if (!operationDocs[key]) errors.push(`${key}: operationDocs に日本語 summary / description がありません`)
      if (!hasJapanese(operation.summary)) errors.push(`${key}: summary に日本語説明がありません`)
      if (!hasJapanese(operation.description)) errors.push(`${key}: description に日本語説明がありません`)
      if (requiresAuthorization(path)) validateAuthorizationMetadata(errors, key, operation)
      for (const parameter of operation.parameters ?? []) {
        if (!hasJapanese(parameter.description)) errors.push(`${key}: ${parameter.in ?? "parameter"} parameter ${parameter.name ?? "(unknown)"} に日本語 description がありません`)
      }
      validateContentSchemas(api, errors, key, "requestBody", operation.requestBody?.content)
      for (const [status, response] of Object.entries(operation.responses ?? {})) {
        if (!hasJapanese(response.description)) errors.push(`${key}: response ${status} に日本語 description がありません`)
        validateContentSchemas(api, errors, key, `response ${status}`, response.content)
      }
    }
  }

  for (const [name, schema] of Object.entries(api.components?.schemas ?? {})) {
    validateSchemaDescriptions(api, errors, `components.schemas.${name}`, schema)
  }

  return errors
}

function validateAuthorizationMetadata(errors: string[], key: string, operation: OperationObject): void {
  const auth = operation["x-memorag-authorization"]
  if (!auth) {
    errors.push(`${key}: x-memorag-authorization がありません`)
    return
  }
  if (!auth.mode) errors.push(`${key}: x-memorag-authorization.mode がありません`)
  if (!Array.isArray(auth.allowedRoles)) errors.push(`${key}: x-memorag-authorization.allowedRoles がありません`)
  if (!Array.isArray(auth.deniedRoles)) errors.push(`${key}: x-memorag-authorization.deniedRoles がありません`)
  if (!Array.isArray(auth.errors)) errors.push(`${key}: x-memorag-authorization.errors がありません`)
  if (!operation.responses?.["401"]) errors.push(`${key}: protected API に 401 response がありません`)
  if (auth.mode !== "authenticated" && !operation.responses?.["403"]) errors.push(`${key}: permission protected API に 403 response がありません`)
}

export function parametersByGroup(operation: OperationObject, group: ParameterGroup): ParameterObject[] {
  return (operation.parameters ?? []).filter((parameter) => parameter.in === group)
}

export function parameterRows(parameters: ParameterObject[]): FieldRow[] {
  return parameters.map((parameter) => ({
    name: parameter.name ?? "-",
    type: schemaType(parameter.schema),
    required: Boolean(parameter.required),
    description: parameter.description ?? "-",
    constraints: schemaConstraints(parameter.schema)
  }))
}

export function contentRows(api: OpenApiDocument, content: Record<string, MediaTypeObject> | undefined): Array<{ mediaType: string; rows: FieldRow[] }> {
  if (!content || Object.keys(content).length === 0) return []
  return Object.entries(content)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([mediaType, media]) => ({ mediaType, rows: schemaRows(api, media.schema, "data") }))
}

export function responseRows(api: OpenApiDocument, responses: Record<string, ResponseObject> | undefined): Array<{ status: string; description: string; mediaType: string; rows: FieldRow[] }> {
  const output: Array<{ status: string; description: string; mediaType: string; rows: FieldRow[] }> = []
  for (const [status, response] of Object.entries(responses ?? {}).sort(([a], [b]) => a.localeCompare(b))) {
    const content = response.content
    if (!content || Object.keys(content).length === 0) {
      output.push({ status, description: response.description ?? "-", mediaType: "-", rows: [] })
      continue
    }
    for (const [mediaType, media] of Object.entries(content).sort(([a], [b]) => a.localeCompare(b))) {
      output.push({ status, description: response.description ?? "-", mediaType, rows: schemaRows(api, media.schema, "response") })
    }
  }
  return output
}

export function schemaRows(api: OpenApiDocument, schema: SchemaObject | undefined, rootName: string): FieldRow[] {
  const rows: FieldRow[] = []
  collectSchemaRows(api, rows, schema, rootName, new Set(), 0)
  return rows.length > 0 ? rows : [{
    name: rootName,
    type: schemaType(schema),
    required: true,
    description: schema?.description ?? `${rootName} の値。`,
    constraints: schemaConstraints(schema)
  }]
}

function collectSchemaRows(api: OpenApiDocument, rows: FieldRow[], schema: SchemaObject | undefined, prefix: string, visited: Set<string>, depth: number): void {
  if (!schema || depth > 8) return
  const resolved = resolveSchema(api, schema)
  if (!resolved) return

  const variants = [...(resolved.allOf ?? []), ...(resolved.oneOf ?? []), ...(resolved.anyOf ?? [])]
  if (variants.length > 0 && !resolved.properties) {
    variants.forEach((variant, index) => collectSchemaRows(api, rows, variant, `${prefix}#${index + 1}`, visited, depth + 1))
    return
  }

  if (resolved.type === "object" || resolved.properties) {
    const required = new Set(resolved.required ?? [])
    for (const [name, property] of Object.entries(resolved.properties ?? {})) {
      const fieldName = prefix === "data" || prefix === "response" ? name : `${prefix}.${name}`
      const resolvedProperty = resolveSchema(api, property) ?? property
      rows.push({
        name: fieldName,
        type: schemaType(property),
        required: required.has(name),
        description: resolvedProperty.description ?? descriptionForField(name, fieldName),
        constraints: schemaConstraints(resolvedProperty)
      })

      const refKey = typeof property.$ref === "string" ? property.$ref : fieldName
      if (visited.has(refKey)) continue
      visited.add(refKey)
      if (resolvedProperty.type === "object" || resolvedProperty.properties) {
        collectSchemaRows(api, rows, resolvedProperty, fieldName, visited, depth + 1)
      } else if (resolvedProperty.type === "array" && resolvedProperty.items) {
        const item = resolveSchema(api, resolvedProperty.items) ?? resolvedProperty.items
        if (item.type === "object" || item.properties) {
          collectSchemaRows(api, rows, item, `${fieldName}[]`, visited, depth + 1)
        }
      }
    }
    return
  }

  if (resolved.type === "array" && resolved.items) {
    collectSchemaRows(api, rows, resolved.items, `${prefix}[]`, visited, depth + 1)
  }
}

function applySchemaDescriptions(api: OpenApiDocument, schema: SchemaObject, context: string): void {
  const resolved = resolveSchema(api, schema)
  if (!resolved) return

  if (!hasJapanese(resolved.description)) {
    resolved.description = descriptionForField(context.split(".").at(-1) ?? context, context)
  }

  for (const [name, property] of Object.entries(resolved.properties ?? {})) {
    const resolvedProperty = resolveSchema(api, property) ?? property
    if (!hasJapanese(resolvedProperty.description)) {
      resolvedProperty.description = descriptionForField(name, `${context}.${name}`)
    }
    applySchemaDescriptions(api, resolvedProperty, `${context}.${name}`)
  }

  if (resolved.items) applySchemaDescriptions(api, resolved.items, `${context}[]`)
  for (const variant of [...(resolved.allOf ?? []), ...(resolved.oneOf ?? []), ...(resolved.anyOf ?? [])]) {
    applySchemaDescriptions(api, variant, context)
  }
}

function validateContentSchemas(api: OpenApiDocument, errors: string[], key: string, section: string, content: Record<string, MediaTypeObject> | undefined): void {
  for (const [mediaType, media] of Object.entries(content ?? {})) {
    validateSchemaDescriptions(api, errors, `${key} ${section} ${mediaType}`, media.schema)
  }
}

function validateSchemaDescriptions(api: OpenApiDocument, errors: string[], location: string, schema: SchemaObject | undefined, visited = new Set<string>()): void {
  if (!schema) return
  const ref = schema.$ref
  if (ref) {
    if (visited.has(ref)) return
    visited.add(ref)
  }
  const resolved = resolveSchema(api, schema) ?? schema
  if ((resolved.type === "object" || resolved.properties) && !hasJapanese(resolved.description)) {
    errors.push(`${location}: object schema に日本語 description がありません`)
  }
  for (const [name, property] of Object.entries(resolved.properties ?? {})) {
    const fieldLocation = `${location}.${name}`
    const resolvedProperty = resolveSchema(api, property) ?? property
    if (!hasJapanese(resolvedProperty.description)) errors.push(`${fieldLocation}: field に日本語 description がありません`)
    validateSchemaDescriptions(api, errors, fieldLocation, resolvedProperty, visited)
  }
  if (resolved.items) validateSchemaDescriptions(api, errors, `${location}[]`, resolved.items, visited)
  for (const [index, variant] of [...(resolved.allOf ?? []), ...(resolved.oneOf ?? []), ...(resolved.anyOf ?? [])].entries()) {
    validateSchemaDescriptions(api, errors, `${location}#${index + 1}`, variant, visited)
  }
}

function resolveSchema(api: OpenApiDocument, schema: SchemaObject | undefined): SchemaObject | undefined {
  if (!schema?.$ref) return schema
  const name = schema.$ref.replace("#/components/schemas/", "")
  return api.components?.schemas?.[name] ?? schema
}

function schemaType(schema: SchemaObject | undefined): string {
  const resolved = schema
  if (!resolved) return "-"
  if (resolved.$ref) return resolved.$ref.replace("#/components/schemas/", "")
  if (resolved.enum) return `enum(${resolved.enum.map(String).join(" | ")})`
  if (resolved.type === "array") return `array<${schemaType(resolved.items)}>`
  if (Array.isArray(resolved.type)) return resolved.type.join(" | ")
  if (resolved.type) return resolved.format ? `${resolved.type}:${resolved.format}` : resolved.type
  if (resolved.oneOf) return "oneOf"
  if (resolved.anyOf) return "anyOf"
  if (resolved.allOf) return "allOf"
  return "object"
}

function schemaConstraints(schema: SchemaObject | undefined): string {
  if (!schema) return "-"
  const constraints: string[] = []
  if (schema.nullable) constraints.push("nullable")
  if (schema.minLength !== undefined) constraints.push(`minLength=${schema.minLength}`)
  if (schema.maxLength !== undefined) constraints.push(`maxLength=${schema.maxLength}`)
  if (schema.minimum !== undefined) constraints.push(`minimum=${schema.minimum}`)
  if (schema.maximum !== undefined) constraints.push(`maximum=${schema.maximum}`)
  if (schema.minItems !== undefined) constraints.push(`minItems=${schema.minItems}`)
  if (schema.maxItems !== undefined) constraints.push(`maxItems=${schema.maxItems}`)
  if (schema.enum) constraints.push(`enum=${schema.enum.map(String).join(", ")}`)
  return constraints.length > 0 ? constraints.join("<br>") : "-"
}

function parameterDescription(parameter: ParameterObject): string {
  const name = parameter.name ?? "parameter"
  const base = descriptionForField(name, name)
  switch (parameter.in) {
    case "path":
      return `${base} URL path 上で対象リソースを指定します。`
    case "query":
      return `${base} クエリ文字列で検索または一覧条件を指定します。`
    case "header":
      return `${base} HTTP header として送信します。`
    case "cookie":
      return `${base} Cookie として送信します。`
    default:
      return base
  }
}

function requiresAuthorization(path: string): boolean {
  return path !== "/health"
}

function authorizationHeaderParameter(): ParameterObject {
  return {
    name: "Authorization",
    in: "header",
    required: true,
    description: "Cognito JWT またはローカル開発用トークンを Bearer 形式で指定します。",
    schema: {
      type: "string",
      description: "Bearer 認証に利用する Authorization header。"
    }
  }
}

function descriptionForField(name: string, context: string): string {
  if (fieldDescriptions[name]) return fieldDescriptions[name]
  const normalized = name.replace(/([A-Z])/g, " $1").replace(/[_-]/g, " ").toLowerCase()
  return `\`${context}\` の値。項目名は ${normalized} を表します。`
}

function hasJapanese(value: unknown): value is string {
  return typeof value === "string" && japanesePattern.test(value)
}
