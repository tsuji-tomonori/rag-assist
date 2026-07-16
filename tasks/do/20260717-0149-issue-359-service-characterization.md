# Issue #359 Phase 4a: MemoRagService characterization と依存グラフ

- 状態: do
- タスク種別: 調査
- Issue: #359
- 対象 branch: `codex/issue-359-service-characterization`
- base: `origin/main` (`8a427a24`)

## 背景

`MemoRagService` を同名 facade の公開契約を維持したまま段階分割する前に、現行 main の公開メソッド、consumer、constructor site、内部依存を source-backed な契約として固定する必要がある。Phase 4a では挙動や API を変更せず、後続の 4b〜4x が意図しない契約変更を検出できる土台だけを追加する。

## 着手前 overlap 監査

- #355 / #356 / #357 は 2026-07-15 に merge 済みで、Issue #359 Phase 0 の着手 gate は解消済み。
- #339 は `apps/api/src/rag/memorag-service.ts` と既存 `memorag-service.test.ts` を直接変更する open / DIRTY PR。
- #387 は同 service を直接変更し、`deleteConversationHistory` の返却型変更と `getConversationHistory` 追加を含む stacked draft PR。
- 本タスクでは service 本体と既存巨大 test を編集せず、独立した contract test と新規設計文書へ限定して path conflict を避ける。#387 取り込み時に contract 差分を明示レビューする必要は残る。

## 目的

- current main の `MemoRagService` 公開 contract を型と source inventory で固定する。
- route / worker / oRPC の consumer、constructor site、private/store/AWS/policy dependency を narrow dependency graph として記録する。
- tenant / permission / audit / compensation / artifact / error status の既存 characterization が後続分割でも維持されることを既存 test 根拠と新規 guard で示す。

## Scope

### In scope

- 公開メソッド名と TypeScript signature の snapshot/type contract test
- route / worker / oRPC `Pick<MemoRagService, ...>` consumer と constructor site の source-backed inventory test
- private field、store / AWS client / policy dependency の source-backed inventoryと後続抽出境界
- 既存 characterization test の根拠マップ
- 最小の durable design doc と作業レポート

### Out of scope

- `MemoRagService` 本体、公開 signature、route、worker、oRPC の変更
- 認可、tenant partition、idempotency、audit、compensation、artifact key、error status の挙動変更
- store / schema / API / 永続化形式の変更
- generated docs の一括再生成
- merge / deploy / release

## 実施計画

1. current main の service 規模、公開/private method、consumer/constructor、依存を計測する。
2. 公開メソッド名・signature と consumer graph を独立 contract test に固定する。
3. 既存 characterization test の根拠と narrow port 候補を設計文書に記録する。
4. 変更範囲に応じた API test/typecheck/build、docs freshness、root CI を実行する。
5. report、commit、draft PR、AC / self-review、task lifecycle、final-head CI、Issue コメントまで進める。

## ドキュメント保守計画

- `docs/DOCS_STRUCTURE.md` に従い、Phase 4a の依存グラフを新規の詳細設計文書へ限定して追加する。
- README、OpenAPI、API examples は挙動・公開 HTTP contract が変わらないため更新しない。
- generated docs は freshness check のみ行い、差分がなければ更新しない。

## 受け入れ条件

- [x] AC1: current main の全公開メソッド名と TypeScript signature が exact contract test で固定される。
- [x] AC2: route / worker / oRPC consumer と全 constructor site が source-backed inventory test で固定される。
- [x] AC3: private field、store / AWS client / policy の主要依存が設計文書で分類され、サブサービスへ `Dependencies` 全体を渡さない narrow port 方針が明記される。
- [x] AC4: tenant / permission / idempotency / audit / compensation / artifact key / error status の既存 characterization 根拠が文書化され、弱体化する実装変更がない。
- [x] AC5: API の targeted/full test、typecheck、build、root CI、OpenAPI/API code docs freshness が成功する。未実施項目は理由を記録する。
- [x] AC6: service 本体、公開 API、認可、永続化、generated docs に不要な変更がない。
- [ ] AC7: 日本語 draft PR、semver label、AC / self-review comment、task done lifecycle、final-head CI、Issue #359 progress comment、CLEAN を完了する。

## 検証計画

- `git diff --check`
- 新規 characterization test の targeted 実行
- `npm run typecheck -w @memorag-mvp/api`
- `npm test -w @memorag-mvp/api`
- `npm run build -w @memorag-mvp/api`
- `npm run docs:openapi:check`
- `npm run docs:api-code:check`
- `npm run ci`
- source audit（benchmark期待語句、QA sample固有値、dataset固有分岐を追加していないこと）

## PR セルフレビュー観点

- main の contract を正しく固定し、open PR の未取り込み変更を current contract と誤記していないか。
- docs と test の method/consumer/dependency inventory が一致するか。
- characterization が既存の RAG 根拠性・tenant・認可境界を弱めていないか。
- generated docs や historical report を漫然と書き換えていないか。
- #387 の semantic overlap と取り込み時の更新責任を残存リスクとして明示しているか。

## リスク

- #387 が公開 signature を変更するため、merge 順によって contract test の更新が必要になる。
- source text だけの brittle assertion に寄り過ぎると無害な整形で失敗するため、TypeScript type contract と構造化 inventory を主にする。
- 全 `Dependencies` を一度に分割する変更は Phase 4a の範囲外であり、本タスクでは候補 port の可視化までとする。

## 実施結果（PR 作成前）

- 公開 101 method の名前を型レベルで exact 固定し、TypeScript checker が解決した signature snapshot を追加した。
- REST route / worker / oRPC consumer、production 6 箇所と test 52 expression の constructor、`Dependencies` 31 key、直接参照 27 key、AWS 3 import、policy 24 import を source-backed test に固定した。
- `DES_DLD_012.md` に既存 characterization 根拠、全 `Dependencies` を渡す既存上限、narrow port 候補、#387 との contract 差分を記録した。
- targeted test の初回実行で direct dependency inventory に `accountRevocationRegistry` が欠けていることを検出し、期待値を修正して再実行に成功した。
- root `npm run ci` の初回実行で型だけに使っていた method 名 inventory が lint error になったため runtime exact assertion として利用し、lint、targeted test、root CI を再実行して成功した。

## 検証結果（PR 作成前）

- `npm test -w @memorag-mvp/api -- --test-name-pattern="MemoRagService public contract|MemoRagService source-backed dependency graph"`: 成功
- `npm run typecheck -w @memorag-mvp/api`: 成功
- `npm test -w @memorag-mvp/api`: 806 tests / 806 pass
- `npm run build -w @memorag-mvp/api`: 成功
- `npm run docs:openapi:check`: 成功
- `npm run docs:api-code:check`: 成功（97 APIs / 582 docs）
- `npm run ci`: 成功（lint、全 workspace typecheck/test/build）
- 実 AWS、deploy、smoke、benchmark 実行: 未実施。production code と runtime behavior を変更しない source characterization のため対象外とした。
- web build の 500 kB 超 chunk warning、`npm ci` の既存 8 vulnerabilities（low 2 / moderate 1 / high 5）は本変更起因ではなく、修正していない。
