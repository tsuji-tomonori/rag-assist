# Issue #345 chat・history・assignee journey 作業レポート

## 受けた指示

GitHub Issue #345 の全体完了へ向け、stacked draft PR の第 7 milestone として chat、history、担当者 workspace を横断する question-to-human-response journey を実装・検証する。Repository Agent Instructions に従い、task、正規 docs、生成 docs、テスト、commit、draft PR、PR コメント、task lifecycle まで進める。

## 要件整理

- RAG の処理中、回答、回答不能、citation、clarification と、有人対応の送信、割当、対応中、回答済み、解決済みを同じ対象に関連付けて区別する。
- status と次の操作、mutation の対象・結果・証跡を chat、history、担当者 workspace で明示する。
- retry/duplicate/late/partial/error を成功へ丸めず、requester/assignee の認可境界と `internalMemo` 等の機微情報境界を維持する。
- long answer、many history、zero citation、mobile、keyboard、axe を自動検証し、手動確認を実施済みと偽らない。

## 検討・判断

- assistant 発話に安定した `messageId` を付け、問い合わせ作成時の requester identity と組み合わせた deterministic ID を API store で生成する。DynamoDB の conditional write と local store の既存照合により同一送信を同一 ticket として扱う。
- 旧履歴は `sourceQuestion` が一意な場合だけ fallback 関連付けを許し、同文質問へ誤接続しない。
- mutation は `OperationOutcome` の success/partial/failure/unknown を返し、UI は対象 ID 付き feedback を表示する。通信断は結果未確認として再実行前の状態確認を促す。
- 回答下書きは保存 API がないため「この画面に入力を一時保持」と表示し、永続保存を装わない。
- screen reader は role/name/live region と axe の自動 proxy のみを証跡とし、実支援技術・200% zoom・実端末は Issue 全体の後続 manual gate に残す。

## 実施作業

- API の Question/Conversation schema、OpenAPI 説明、local/DynamoDB question store に `messageId` と idempotent create を追加した。
- chat の発話 ID、回答種別 status、citation 件数、次操作、有人送信/解決 feedback を追加した。
- 担当者 workspace に 5 状態の presentation、割当、次操作、対象付き回答結果、terminal form lock、正直な local-only input hold を追加した。
- history に最も action が必要な ticket の status、件数、次操作を表示し、回答者用 `internalMemo` が requester へ出ない E2E を追加した。
- semantic badge の意味色が履歴の汎用 text rule に上書きされない selector と WCAG AA contrast を修正した。
- FR、`DES_UI_UX_001`、API/data/DLD、UI traceability、OpenAPI/API code/Web inventory を同期した。
- `E2E-UI-QUESTION-001` と `E2E-UI-QUESTION-002`、unit/contract/access test、visual baseline を追加・更新した。

## 成果物

- task: `tasks/do/20260714-issue-345-chat-assignee-journey.md`
- 仕様分析: `reports/working/20260714-2215-issue-345-chat-assignee-spec-analysis.md`
- E2E: `apps/web/e2e/question-journey.spec.ts`
- API identity: `apps/api/src/adapters/question-identity.ts`
- UI presentation: `apps/web/src/features/chat/utils/chatJourney.ts`、`apps/web/src/features/questions/utils/questionJourney.ts`
- trace: `tools/web-inventory/ui-traceability.json`
- PR: 未作成（commit/push 後に本レポートへ追記する）

## 検証

- `npm test -w @memorag-mvp/web`: 51 files / 389 tests 成功。
- `npm test -w @memorag-mvp/api`: 775 tests 成功済み。最終 `messageId` schema 制約後は関連 7 test files を再実行し、すべて成功した。
  - sandbox 内: identity、DynamoDB/local store、schema、route、service。
  - sandbox 外: `questions-access.test.ts` 1/1。requester 所有者境界、assignee 可視範囲、機微情報除外、同一 `messageId` の再送を確認した。
- `npm run test:e2e -w @memorag-mvp/web -- e2e/question-journey.spec.ts`: 2/2 成功。refusal → escalation → assignee answer → requester history → resolve、answer/citation、clarification、mobile、long/many/zero、keyboard focus/Enter、axe を確認した。
- visual regression の「回答と引用表示」「管理系画面」: baseline 更新実行 2/2、更新なし再実行 2/2。2 枚を目視し、明白な重なり・横あふれがないことを確認した。
- `npm run test:web-semantic-ui`: 1/1 成功。
- `npm run lint`: 成功。
- `npm run typecheck`: 全 workspace 成功。
- `npm run build`: 全 workspace 成功。Web と Lambda bundle の既存 size warning は出たが失敗ではない。
- `task docs:check`: 成功。95 API / 570 API docs freshness、OpenAPI、Web trace/inventory、infra inventory、hidden Unicode を含む。
- `git diff --check`: 成功。

### 検証中の失敗と修復

- axe が履歴 badge の contrast 4.37:1 を検出した。汎用 `span` rule と semantic tone の selector 競合を修正し、同 E2E を再実行して 2/2 成功した。
- 関連 API test の最初の直接実行では package script の test environment を省略し、2 files が file-level failure になった。環境を揃えると service は成功した。
- `questions-access.test.ts` は test 内の localhost server 起動が sandbox で拒否され再度 file-level failure になった。影響とコマンドを明示して sandbox 外で再実行し、1/1 成功した。これらの失敗を製品 test 成功へ読み替えていない。

## 指示への fit 評価

- 実データ/API 状態に由来する表示と明示的な empty/loading/error/permission state を使い、本番 fallback に架空 ticket・件数・保存結果を追加していない。
- RAG の回答不能と citation 0 件を回答成功へ変換せず、回答種別を API の `responseType` から優先判定する。
- route/auth/resource policy は変更せず、requester/assignee access test と差分レビューで境界維持を確認した。
- benchmark 期待語句、QA sample 固有値、dataset 固有分岐を実装へ追加していない。
- 正規 docs と生成 docs は freshness check まで同期した。

## 未対応・制約・リスク

- 実 screen reader、200% zoom、実端末の手動確認は未実施。Issue #345 全体の manual/gate milestone で扱い、自動 axe/visual を代替実施済みとはしない。
- notification channel と SLA は既存契約にないため実装していない。
- build の chunk/bundle size warning と既存 `npm audit` の 8 vulnerabilities（low 2 / moderate 1 / high 5）は本 milestone では変更していない。
- stacked draft PR #348〜#353 が未 merge のため、本 milestone も同一 base への draft PR とし、依存関係を PR 本文に明記する。
