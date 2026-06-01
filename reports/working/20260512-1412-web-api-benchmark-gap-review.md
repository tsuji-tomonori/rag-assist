# web / api / benchmark 実装ベース仕様漏れ確認 作業レポート

- 作成日時: 2026-05-12 14:12
- 対象:
  - `memorag-bedrock-mvp/apps/web/src`
  - `memorag-bedrock-mvp/apps/api/src`
  - `memorag-bedrock-mvp/benchmark`
- 成果物: `.workspace/rag-assist_仕様追加_統合版_実装ベース未記載追補.md`

## 指示

「web/app/benchmaerk すべて確認し、漏れを反映して。/plan」

`app` は `apps/api`、`benchmaerk` は `benchmark` の typo と解釈した。

## 要件整理

- Web / API / benchmark の実装全体から、既存の仕様追補にまだ漏れている機能・処理を確認する。
- 漏れは既存の `.workspace` 追補ファイルに反映する。
- commit / PR は不要。

## 実施作業

- `apps/web/src` 155 files、`apps/api/src` 139 files、`benchmark` 74 files のファイル一覧を取得した。
- route、Web app shell、admin / questions / history / benchmark UI、oRPC、error handling、benchmark runner / metrics を確認した。
- `.workspace/rag-assist_仕様追加_統合版_実装ベース未記載追補.md` に 11 件の追加項目を追記した。
- 反映優先度と全量性メモも更新した。

## 追加した主な項目

- HITL 質問 ticket と requester / assignee 境界。
- Conversation history / favorite / local autosave contract。
- Web app shell の権限別初期ロード・自動遷移・URL state。
- Benchmark run UI と artifact / log download contract。
- REST と oRPC の並行 API contract。
- Safe API error response hardening。
- Admin user / audit / usage / cost の side-effect refresh。
- CodeBuild suite manifest と prepare/run 分離。
- Search benchmark 専用 runner と ACL leak metric。
- Conversation benchmark 専用 runner。
- Quality review / alias candidate proposal。

## 検証

- `wc -l .workspace/rag-assist_仕様追加_統合版_実装ベース未記載追補.md`
  - 499 行。
- `rg -n "^### 3\\.|HITL|oRPC|CodeBuild suite|Search benchmark|Conversation benchmark|Quality review|対象 file count|^## 5|^## 6" ...`
  - 3.1 から 3.24 までの追補項目、追加項目、反映優先度、全量性メモを確認。
- コード実行テストは未実施。
  - 理由: 今回は実装変更ではなく `.workspace` の仕様追補更新のみ。

## Fit 評価

- 指示された Web / API / benchmark を実装ファイル一覧から再確認し、漏れを既存成果物へ反映した。
- `/plan` と commit 不要の文脈に合わせ、commit / PR は作成していない。

## 未対応・制約・リスク

- 生成済み benchmark output、CSS の詳細、テスト fixture、adapter/store 内部の全差分は仕様項目ではなく設計詳細または検証資材として扱い、深掘り対象から外した。
- `.workspace` は git status に出ないため、成果物の存在確認で検証した。
