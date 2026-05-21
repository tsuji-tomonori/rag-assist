# PR326 legacy POST /documents benchmark seed metadata 境界修正

- 状態: done
- タスク種別: 修正
- 対象 PR: https://github.com/tsuji-tomonori/rag-assist/pull/326

## 背景

再レビューで、upload session 経由の `purpose=document` ingest は修正済みだが、legacy `POST /documents` では benchmark seed 予約 metadata の部分混入や extra key 付き seed 形 metadata が通常文書扱いで通る可能性が残っていると指摘された。

## 目的

legacy `POST /documents` でも、benchmark seed 専用 metadata key を含む通常文書 upload を fail-closed にし、`benchmark:seed_corpus` 境界を direct upload と upload session の両方で一貫させる。

## スコープ

- `authorizeDocumentUpload` の予約 metadata key 拒否
- 既存 helper の汎用化
- `api-contract.test.ts` の `document writer cannot bypass group scope with benchmark seed metadata` への回帰テスト追加
- targeted API contract test、API typecheck、diff check、作業レポート、PR 更新コメント

## なぜなぜ分析サマリ

- confirmed: `authorizeDocumentUpload` は `isBenchmarkSeedUpload(body)` が true の場合のみ `benchmark:seed_corpus` を要求する。
- confirmed: `isBenchmarkSeedUploadMetadata` は metadata key が whitelist と完全一致することを前提にするため、`tenantId` など extra key があると seed 判定は false になる。
- confirmed: seed 判定が false の場合、`authorizeDocumentUpload` は `rag:doc:write:group` があれば通常文書として許可する。
- inferred: upload session 側で追加した予約 key guard が `IngestUploadedDocumentRequestSchema` 専用 helper になっており、direct upload の auth 境界へ水平展開されていなかった。
- root cause: benchmark seed の「正当な seed body 判定」と「通常文書で禁止すべき seed 予約 metadata 検出」が同じ `isBenchmarkSeedUpload` 判定に依存しており、完全形でない seed 予約 metadata を fail-closed にする guard が direct upload に欠けていた。
- remediation: `metadata?: Record<string, unknown>` を受ける汎用 helper で seed 予約 key を検出し、`authorizeDocumentUpload` と uploaded ingest の両方から利用する。

## 実装計画

1. `hasBenchmarkSeedReservedDocumentMetadata` を汎用 metadata body helper に変更する。
2. `authorizeDocumentUpload` で `isBenchmarkSeedUpload` の false 後、予約 metadata key があれば 403 にする。
3. extra key 付き seed metadata と部分的な seed 予約 metadata の `POST /documents` 403 を contract test に追加する。
4. API contract test、API typecheck、`git diff --check` を実行する。
5. レポート、commit、push、PR コメント、task done 更新を行う。

## ドキュメント保守計画

API shape や利用手順は変えず、既存の benchmark seed 権限境界を fail-closed にする修正のため、恒久 docs 更新は不要と判断する。判断理由は作業レポートと PR コメントに残す。

## 受け入れ条件

- `POST /documents` は benchmark seed metadata に extra key があっても document writer では 403 になる。
- `POST /documents` は `benchmarkSeed` や `benchmarkSuiteId` だけの部分的な benchmark seed 予約 metadata も 403 にする。
- 403 後に対象 document が `/documents` に作成されない。
- upload session 側の既存拒否・許可ケースを壊さない。
- 変更範囲に見合う targeted test と typecheck が pass する。

## 検証計画

- `../../node_modules/.bin/tsx --test src/contract/api-contract.test.ts`
- `npm run typecheck -w @memorag-mvp/api`
- `git diff --check`

## リスク

- 通常文書 metadata に benchmark seed 専用 key を使う既存クライアントがある場合は 403 になる。ただし該当 key は benchmark seed 境界の予約 key として扱うため、意図した fail-closed 変更と判断する。

## 完了記録

- 実装 commit: `9d100bdc8ada005d5bf715fb21cda332050fbc47`
- PR body 更新: GitHub Apps 経由で実施
- 受け入れ条件確認コメント: https://github.com/tsuji-tomonori/rag-assist/pull/326#issuecomment-4503863952
- セルフレビューコメント: https://github.com/tsuji-tomonori/rag-assist/pull/326#issuecomment-4503865112
- 検証:
  - `../../node_modules/.bin/tsx --test src/contract/api-contract.test.ts`: pass
  - `npm run typecheck -w @memorag-mvp/api`: pass
  - `git diff --check`: pass
