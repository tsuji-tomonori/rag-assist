# スコープ付き資料グループ管理

保存先: `tasks/do/20260508-1310-scoped-document-groups.md`

## 状態

- do
- 実装・検証完了。PR 作成、受け入れ条件コメント、セルフレビューコメント後に `tasks/done/` へ移動する。

## 背景

資料を永続的なグループ/フォルダ単位で管理し、質問時に参照範囲を明示できる必要がある。例として、社内規定への質問では社内規定フォルダを指定し、そのフォルダ内資料だけを根拠に QA する。個人単位のフォルダ作成、共有、一時添付資料のチャット内限定参照も必要である。

既存実装では文書 ACL は manifest/vector metadata の `aclGroups` / `allowedUsers` を中心に制御され、チャット添付は通常文書として取り込まれるため、チャット限定スコープになっていない。

## 目的

永続資料グループ、個人フォルダ、共有フォルダ、一時添付スコープを API / 検索 / チャット / Web UI / docs / tests で一貫して扱う。

## 対象範囲

- API schema / route / service
- 文書 manifest と vector metadata の scope metadata
- hybrid search と agent memory/evidence retrieval の scope filtering
- chat run の scope 永続化
- Web の文書管理 UI とチャット UI
- requirements / design / API docs
- targeted API/Web tests と access-control policy

## 実行計画

1. `DocumentGroup` 型、schema、ledger 保存を追加する。
2. `/document-groups` API と共有 API を追加する。
3. 文書 upload / ingest に `scopeType`、`groupIds`、`temporaryScopeId`、`expiresAt` を追加する。
4. `searchScope` を search / chat request に追加し、非同期 chat run に保存する。
5. 検索と memory retrieval に scope filter と可視性検証を入れる。
6. チャット添付を `chatAttachment` purpose として取り込み、該当 chat scope のみで参照する。
7. Web UI でフォルダ管理、保存先選択、参照フォルダ選択、一時添付表示を実装する。
8. docs と tests を更新する。

## ドキュメントメンテナンス計画

- requirements: 文書・知識ベース管理配下にスコープ付き資料グループ要件を追加し、README index を更新する。
- data design: `DocumentGroup`、`SearchScope`、一時添付 metadata を追加する。
- API design / examples: `/document-groups`、document upload scope、chat/search scope を追記する。
- operations: TTL 付き一時添付の制約や削除残存リスクがあれば追記する。

## 受け入れ条件

- 社内規定など永続フォルダを作成し、文書を所属させられる。
- チャットでフォルダを指定すると、そのフォルダ内の可視文書だけが検索・回答根拠になる。
- 個人フォルダは owner だけが管理でき、未共有 user からは一覧・検索・citation で見えない。
- 共有先 user / group は共有フォルダの文書を参照できる。
- 一時添付資料は通常の文書一覧に永続フォルダ資料として混ざらず、同じチャットスコープ内だけで検索対象になる。
- 非同期 `chat-runs` は作成時の `searchScope` を保存し、worker 実行時にも同じ範囲で検索する。
- debug/search diagnostics には ACL metadata、共有先詳細、raw scope ledger を露出しない。
- route-level permission と owner/shared 境界が API tests / static access-control test で検証されている。
- requirements / design / API docs の更新要否が反映されている。

## 検証計画

- `npm --prefix memorag-bedrock-mvp run test -w @memorag-mvp/api`
- `npm --prefix memorag-bedrock-mvp run typecheck -w @memorag-mvp/api`
- `npm --prefix memorag-bedrock-mvp run test -w @memorag-mvp/web`
- `npm --prefix memorag-bedrock-mvp run typecheck -w @memorag-mvp/web`
- `git diff --check`
- 必要に応じて `task docs:check:changed`

## PRレビュー観点

- RAG の根拠性・認可境界を弱めていないこと。
- group scope と ACL group を混同して権限外資料が漏れないこと。
- 一時添付が永続資料一覧や通常検索に混入しないこと。
- benchmark seed の隔離 metadata を壊していないこと。
- docs と API schema が同期していること。

## 未決事項・リスク

- TTL 期限切れ object/vector の物理削除は、既存 store に自動 cleanup がないため初期実装では検索除外を優先し、物理削除は後続運用タスクに分離する可能性がある。
- 本番 Cognito group 共有は既存 group 名に依存する。UI 上の候補取得は既存 admin user/role API の範囲で対応する。

## 実装結果

- `DocumentGroup` と `SearchScope` を API 型/schema、service、route、agent state、search に追加した。
- `/document-groups`、`/document-groups/{groupId}/share` を追加した。
- 文書 upload / ingest / async ingest に `scopeType`、`groupIds`、`temporaryScopeId`、`expiresAt` を追加した。
- チャット添付を `purpose=chatAttachment` として同一 conversation の一時スコープだけで参照するようにした。
- Web UI に参照フォルダ選択、保存先フォルダ選択、フォルダ作成、共有更新、フォルダ表示を追加した。
- `FR-041`、データ設計、API 設計、トレーサビリティ、作業レポートを追加した。

## 検証結果

- `npm --prefix memorag-bedrock-mvp run typecheck -w @memorag-mvp/api`: 成功。
- `npm --prefix memorag-bedrock-mvp run test -w @memorag-mvp/api -- src/security/access-control-policy.test.ts src/authorization.test.ts src/contract/api-contract.test.ts`: 成功。package test script により API test 170 件を実行。
- `npm --prefix memorag-bedrock-mvp run typecheck -w @memorag-mvp/web`: 成功。
- `npm --prefix memorag-bedrock-mvp run test -w @memorag-mvp/web`: 成功。27 files / 163 tests。
- `task memorag:verify`: 成功。
- `git diff --check`: 成功。
- `task docs:check:changed`: Taskfile に存在しないため未実施。`git diff --check` と `task memorag:verify` で代替した。
