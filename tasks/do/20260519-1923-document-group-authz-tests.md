# document-groups 権限テストと実装修正

状態: in_progress
タスク種別: 修正

## 背景

仕様上の「フォルダ」は API / 実装上 `document-groups` として扱われる。`GET/POST /document-groups`、`POST /document-groups/{groupId}/share`、文書 upload / ingest / delete / reindex / search / chat の scope 認可について、P0 を中心にテストを追加し、失敗するケースから実装修正を行う。

## 目的

- `document-groups` 周辺の RBAC と resource permission を回帰テストで固定する。
- search / chat で権限外 group / document / chunk が混入しないことを確認する。
- Web の readOnly UI で handler が呼ばれないこと、API 403 を成功扱いしないことを確認する。
- 親共有継承と子の個別ポリシー優先を仕様回帰テストとして追加し、必要な実装を行う。

## 軽量なぜなぜ分析

- 問題文: `document-groups` を folder として扱う権限仕様に対して、親共有継承や readOnly/full の境界がテストで十分に固定されていないため、検索・チャット・文書操作・UI 操作で権限漏れまたは過剰許可が混入するリスクがある。
- 確認済み事実:
  - ユーザー指示で `document-groups`、`documents`、`search`、`chat` が権限付き operation として挙げられている。
  - 既存実装は `listDocumentGroups(user)` / `listDocuments(user)` / `assertSearchScopeReadable` などで resource permission を確認する設計である。
  - 現行の gap として、親 sharing 継承と子の個別設定優先が明示的に保証されていない。
- 推定原因:
  - folder 仕様が `document-groups` 実装へ段階的に拡張され、RBAC、resource permission、UI gate、RAG scope の検証が分散している。
- 根本原因:
  - 仕様上重要な権限境界を横断して検証する targeted regression test が不足している。
- 対策:
  - P0 の API/Web 権限マトリクスを既存テスト構造へ追加する。
  - 追加テストで露出した実装ギャップを、認可 helper または UI handler guard の最小範囲で修正する。
  - 関連テストを再実行し、未実施項目を明記する。

## スコープ

- API: `document-groups`、documents upload/ingest/delete/reindex、search、chat の権限テストと必要な認可修正。
- Web: `DocumentWorkspace` と関連 hook の readOnly / permission error テストと必要な UI handler guard 修正。
- Docs: 永続的な仕様変更が発生した場合のみ最小限更新。テスト追加だけで仕様変更がない場合は作業レポートに理由を記録する。

## 実施計画

1. 既存の API/Web テスト配置と認可 helper を確認する。
2. P0 を中心に既存 fixture に合わせてテストを追加する。
3. テストを実行し、失敗内容を分類する。
4. 実装ギャップを最小範囲で修正する。
5. 対象 API / Web テストを再実行する。
6. 作業レポートを `reports/working/` に残す。

## 受け入れ条件

- P0 のうち API `document-groups` 作成・共有・一覧・文書 upload/delete/reindex の代表的な 403/200 matrix がテストされている。
- API `/search` と `/chat` が権限外 folder / document / chunk を返さない、または scope 指定時に `403` になることがテストされている。
- Web の `canWrite=false` / `canDelete=false` / `canReindex=false` で handler が呼ばれないことがテストされている。
- Web が API 403 を permission error として扱い、成功扱いしないことがテストされている。
- 親共有継承と子の個別ポリシー優先がテストまたは実装で扱われている。未対応が残る場合は fail / blocked として明記されている。
- 変更範囲に応じた API / Web テストが実行され、結果が記録されている。

## 検証計画

- API targeted: `npm run test -w @memorag-mvp/api -- --test-name-pattern document`
- API broad if needed: `npm run test -w @memorag-mvp/api`
- Web targeted: `npm run test -w @memorag-mvp/web -- DocumentWorkspace`
- Diff hygiene: `git diff --check`

## PR レビュー観点

- 認証・RBAC と resource permission の二層が崩れていないこと。
- 権限外 resource 名や key が error / diagnostics / debug に漏れないこと。
- UI の disabled 表示だけでなく submit / action handler が guard されていること。
- テスト fixture の mock data が本番 path に混入していないこと。

## リスク

- P0 全ケースを一度に完全網羅すると変更が過大になるため、既存構造に合わせた代表ケース中心になる可能性がある。
- Playwright E2E はローカルサーバーや fixture 準備が重い場合、Vitest/API targeted を優先し未実施理由を記録する可能性がある。
