# Assistant Profile を profile as data として導入

保存先: `tasks/todo/20260507-2000-assistant-profile-config.md`

## 状態

- todo

## 背景

neoAI Chat の業務別アシスタント運用を取り入れる場合、最初から UI で自由に assistant を作るより、検索対象、用語集、回答ポリシー、確認質問ポリシーを設定データとして持たせる方が安全で評価しやすい。rag-assist には retrieval profile、answer policy、runtime policy、alias 管理の考え方があるため、`AssistantProfile` を既存 profile の集約として導入しやすい。

## 目的

部門別・用途別 assistant をコード分岐なしで作れるように、`AssistantProfile` を設定データとして定義し、KB filter、retrieval profile、answer policy、prompt template、glossary / alias artifact、allowed roles を紐付ける。

## 対象範囲

- Assistant profile schema / resolver
- admin API または config loader
- retrieval profile / answer policy / runtime policy integration
- RBAC / allowedRoles
- benchmark suite の assistant 指定
- Web admin UI は v1 では必要最小限または対象外
- docs / API examples / OpenAPI

## 方針

- v1 では非エンジニア向け assistant builder UI を作らず、versioned config / admin API から開始する。
- assistant ごとの差分は prompt だけに寄せず、knowledge base filter、retrieval profile、answer policy、clarification policy、glossary、alias artifact で表現する。
- 代表 assistant は `規程QA`、`手順QA`、`文書検索QA` の 3 種を seed とする。
- `allowedRoles` と KB filter を必ず route-level / store-level の認可境界より強くしない。
- 既存 task `RAG Policy / Profile 基盤の導入` を依存 task として扱う。

## 必要情報

- 既存 task: `tasks/todo/20260506-1203-rag-policy-profile.md`
- existing retrieval profile / runtime policy / answer policy design。
- Cognito / RBAC / admin users / roles / audit / usage / costs の既存導線。
- 関連 benchmark task: `tasks/todo/20260507-2000-rag-baseline-evaluation-set.md`

## 実行計画

1. 既存 profile / policy / alias / RBAC の実装と docs を棚卸しする。
2. `AssistantProfile` schema と versioning 方針を定義する。
3. profile resolver を追加し、assistantId から KB filter、retrieval profile、answer policy、prompt template、glossary、alias artifact を解決する。
4. `規程QA`、`手順QA`、`文書検索QA` の seed profile を追加する。
5. API / benchmark runner が assistantId を指定できる入口を追加する。
6. RBAC と KB filter の境界をテストする。
7. assistant 別 benchmark suite と report 出力を追加する。
8. docs、OpenAPI、API examples、operations を更新する。

## ドキュメントメンテナンス計画

- 要求仕様: assistant、profile、RBAC、評価に関係する `FR-*`、`SQ-*`、`NFR-*`、`TC-*` を確認し、必要なら追加・更新する。
- architecture / design: Assistant Profile、Policy Resolver、Auth / RBAC、Retrieval workflow、Benchmark Runner の docs を更新する。
- API examples / OpenAPI: assistantId を公開 API に追加する場合は必ず更新する。内部 admin config のみならその理由を PR 本文に書く。
- operations: seed assistant、profile version 管理、変更レビュー、rollback、audit log の確認方法を追記する。
- PR 本文: assistant 別の評価結果、権限境界、未実施 UI 作業を明記する。

## 受け入れ条件

- `AssistantProfile` schema が定義され、version を持つ。
- `規程QA`、`手順QA`、`文書検索QA` の seed profile が存在する。
- 同じ質問でも assistant ごとに検索対象または回答ポリシーを変えられる。
- assistant ごとの allowedRoles と KB filter が RBAC / ACL を弱めない。
- assistantId と profile version が debug trace と benchmark report に残る。
- assistant 別 benchmark suite または suite filter が存在する。
- prompt だけで業務差分を吸収せず、検索対象、用語集、回答ポリシー、確認質問ポリシーとして表現されている。

## 検証計画

- `npm --prefix memorag-bedrock-mvp run test -w @memorag-mvp/api`
- RBAC / ACL boundary tests
- assistant 別 benchmark smoke
- API schema 変更時: OpenAPI check
- Web UI を変更する場合: `npm --prefix memorag-bedrock-mvp run test -w @memorag-mvp/web`
- `git diff --check`

## PRレビュー観点

- `blocking`: assistantId によって本来見えない文書へアクセスできないこと。
- `blocking`: profile config に raw prompt、alias、ACL metadata、内部 debug data が通常利用者へ露出する path がないこと。
- `should fix`: profile version が trace / benchmark / audit へ残ること。
- `should fix`: assistant 差分が prompt だけに閉じていないこと。
- `question`: assistant profile CRUD を v1 で admin API まで作るか、repository config seed に留めるか。

## 未決事項・リスク

- 決定事項: v1 は profile as data を優先し、UI assistant builder は後続 task に回す。
- 決定事項: `allowedRoles` は認可境界を広げるものではなく、既存 RBAC / ACL の上にかかる追加制約として扱う。
- 実装時確認: assistantId を通常 `/chat` API に出すか、admin / benchmark 用 config に限定するか。
- リスク: assistant ごとの policy 差分が増えすぎると評価 matrix と運用レビューが重くなる。
