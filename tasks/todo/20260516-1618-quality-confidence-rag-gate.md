# OCR/table/figure confidence を RAG 利用可否へ接続する

保存先: `tasks/todo/20260516-1618-quality-confidence-rag-gate.md`

## 状態

- todo

## タスク種別

- 機能追加

## 背景

仕様 3B/3C は、OCR・表・図の抽出品質が低い場合に通常 RAG から除外またはレビュー対象にすることを求めている。Phase E で confidence / warning / counters の保存基盤は入ったが、`docs/spec/gap-phase-e.md` の `E-LEFT-002` として、confidence による RAG eligibility enforcement は未実装で残っている。

## 目的

保存済み extraction confidence と Phase C の knowledge quality policy を接続し、低信頼 OCR/table/figure evidence が通常 RAG で断定根拠として使われないようにする。

## 対象範囲

- `apps/api/src/rag/`
- `apps/api/src/chat-orchestration/nodes/search-evidence.ts`
- `apps/api/src/types.ts`
- quality profile / RAG eligibility tests
- 必要に応じて `docs/spec/gap-phase-e.md`, `docs/spec/gap-phase-c.md`

## 実行計画

1. Phase E で保存される confidence / warning / counters の読み取り経路を確認する。
2. document/page/block/table/figure の confidence threshold 方針を定義する。
3. `RagEligibilityPolicy` または quality profile へ confidence gate を接続する。
4. 低信頼 evidence を除外、restricted、review required のいずれに倒すかをテストで固定する。
5. 回答不能・確認促し・担当者対応への接続が必要な場合は scope を分ける。

## 受け入れ条件

- OCR / table / figure confidence が RAG evidence selection で参照される。
- threshold 未満の evidence が通常 RAG の断定根拠として使われない。
- 既存 quality profile 未設定の文書は互換維持される。
- 除外理由が debug trace または sanitized diagnostics で確認できる。
- 権限外文書名、ACL group、raw OCR text、内部 policy 詳細を通常利用者へ露出しない。
- confidence threshold と rollback 方針が docs または PR 本文に記録される。

## 検証計画

- `npm run test -w @memorag-mvp/api -- src/rag/memorag-service.test.ts`
- `npm run test -w @memorag-mvp/api -- src/chat-orchestration/nodes/node-units.test.ts`
- `npm run test -w @memorag-mvp/api -- src/security/access-control-policy.test.ts`
- `git diff --check`

## PRレビュー観点

- RAG の根拠性を強めており、権限境界を弱めていないか。
- confidence 未設定の既存 manifest を壊していないか。
- benchmark 期待値や dataset 固有値を本番ロジックに入れていないか。

## 関連

- `docs/spec/gap-phase-e.md` `E-LEFT-002`
- `docs/spec/gap-phase-c.md`
- `tasks/todo/20260507-2000-document-block-ingestion-v2.md`
