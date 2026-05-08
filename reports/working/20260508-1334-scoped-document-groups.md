# スコープ付き資料グループ管理 実装レポート

## 受けた指示

- 過去の作業レポート、todo を確認し、資料のグループ管理に関する過去指示を踏まえる。
- 資料をグループ単位で管理し、永続化する。
- 社内規定などのフォルダを指定した質問では、そのフォルダ内資料を根拠に QA する。
- 個人単位でもフォルダ作成でき、共有もできる。
- 一時添付した資料は一時スコープとして、そのチャット内だけ参照する。
- スコープを意識した設計を行い、実装する。

## 要件整理

- 永続資料は `DocumentGroup` と文書 metadata の `groupIds` で結び、グループ台帳を object store に保存する。
- 検索は `SearchScope` を受け取り、`all`、`groups`、`documents`、`temporary` の各 mode で対象文書を絞る。
- `mode=groups` でもチャット添付がある場合は、指定グループと同一チャットの一時添付を合成して検索する。
- 一時添付は `scopeType=chat`、`temporaryScopeId=<conversationId>` として保存し、通常文書一覧から除外する。
- グループ共有は owner、manager、shared user、shared Cognito group、org visibility を扱う。

## 検討・判断

- グループ台帳は既存 object store パターンに合わせ、`document-groups/groups.json` に保存した。
- 既存 ACL を弱めないため、検索前に `assertSearchScopeReadable` でグループ参照権限を確認し、lexical/vector/memory retrieval 側でも manifest と metadata を再フィルタする二重境界にした。
- 一時添付は永続資料一覧を汚さないよう、通常の `listDocuments` から除外し、チャット送信時の `searchScope` でだけ参照する。
- benchmark seed の既存隔離 scope と衝突しないよう、`scopeType` は `personal`、`group`、`chat`、`benchmark` の列挙として整理した。

## 実施作業

- API 型、Zod schema、route、authorization、access-control policy を資料グループと検索スコープ対応に更新した。
- `MemoragService` に資料グループ一覧、作成、共有更新、グループ書き込み権限、検索スコープ参照権限の処理を追加した。
- lexical/vector/memory retrieval で `SearchScope`、資料グループ共有、一時添付期限を考慮するようにした。
- Web UI に参照フォルダ選択、保存先フォルダ選択、フォルダ作成、共有設定、フォルダ表示を追加した。
- チャット添付を `chatAttachment` として取り込み、同一 conversation の一時スコープだけで検索するようにした。
- `FR-041` 要件、データ設計、API 設計、トレーサビリティを追加した。

## 成果物

- API: `memorag-bedrock-mvp/apps/api/src/rag/memorag-service.ts`
- API routes: `memorag-bedrock-mvp/apps/api/src/routes/document-routes.ts`
- Search: `memorag-bedrock-mvp/apps/api/src/search/hybrid-search.ts`
- Agent memory retrieval: `memorag-bedrock-mvp/apps/api/src/agent/nodes/retrieve-memory.ts`
- Web: `memorag-bedrock-mvp/apps/web/src/features/documents/*`, `memorag-bedrock-mvp/apps/web/src/features/chat/*`, `memorag-bedrock-mvp/apps/web/src/app/*`
- Docs: `memorag-bedrock-mvp/docs/1_要求_REQ/.../REQ_FUNCTIONAL_041.md`

## 指示への fit 評価

- 永続資料グループ: 実装済み。グループ台帳と文書 metadata で管理する。
- フォルダ指定 QA: 実装済み。`searchScope.mode=groups` で検索対象を絞る。
- 個人単位フォルダ作成: 実装済み。owner を持つ private group として作成する。
- 共有: 実装済み。userId/email/Cognito group/org visibility を扱う。
- 一時添付のチャット内限定: 実装済み。`temporaryScopeId` を conversation ID とし、通常一覧から除外する。
- スコープ設計: 実装済み。型、schema、API、search、agent state、docs に反映した。

## 検証

- `npm --prefix memorag-bedrock-mvp run typecheck -w @memorag-mvp/api`: 成功。
- `npm --prefix memorag-bedrock-mvp run test -w @memorag-mvp/api -- src/security/access-control-policy.test.ts src/authorization.test.ts src/contract/api-contract.test.ts`: 成功。実際には package test script により API test 170 件を実行。
- `npm --prefix memorag-bedrock-mvp run typecheck -w @memorag-mvp/web`: 成功。
- `npm --prefix memorag-bedrock-mvp run test -w @memorag-mvp/web`: 成功。27 files / 163 tests。
- `task memorag:verify`: 成功。lint、workspace typecheck、build を実行。
- `git diff --check`: 成功。
- `task docs:check:changed`: 未実施。Taskfile に該当 task が存在しなかったため、`git diff --check` と `task memorag:verify` で代替確認した。

## 未対応・制約・リスク

- UI の共有入力は Cognito group のカンマ区切りを優先しており、個別 user/email 共有の専用入力は API 対応済みだが UI は最小実装である。
- 一時添付の期限切れ object cleanup は検索除外まで実装し、物理削除 job は未実装である。
- `task docs:check:changed` は Taskfile に存在しなかった。
