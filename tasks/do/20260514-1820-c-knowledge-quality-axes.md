# C knowledge quality axes

- 状態: in_progress
- タスク種別: 機能追加
- branch: `codex/phase-c-knowledge-quality-axes`
- worktree: `.worktrees/phase-c-knowledge-quality-axes`
- base: `origin/main`

## 背景

Wave 3 の `C-knowledge-quality-axes` として、仕様 3B / `docs/spec/gap-phase-c.md` に基づき、ナレッジ品質 4 軸と RAG eligibility の最小実装を入れる。

## 目的

通常 RAG で参照される evidence を、既存の search scope、ACL、active lifecycle に加えて、型付き quality profile / RAG eligibility によって制御する。既存文書は未指定なら通常 RAG eligible 相当に扱い、明示的な excluded 等は通常 RAG evidence から除外する。

## スコープ

- `DocumentQualityProfile` と品質 enum を既存 `DocumentLifecycleStatus` から分離して追加する。
- manifest 再確認経路に quality gate を接続する。
- lexical index、semantic vector hit 再確認、memory hit、memory source chunk expansion に同じ quality-approved 判定を通す。
- user-facing response に権限外文書や詳細な quality exclusion reason を漏らさない。
- `docs/spec/gap-phase-c.md` に実装結果と open question を追記する。
- `reports/working/*c-knowledge-quality-axes*.md` に作業レポートを作成する。

## スコープ外

- ParsedDocument / OCR / table / figure schema の本格実装。
- `apps/api/src/agent` rename。
- benchmark/dataset 固有期待値の本番実装への埋め込み。
- 品質変更監査ログ、管理 UI、警告付き回答 UI/API の本格実装。

## 実装計画

1. 既存の document manifest、hybrid search、memory retrieval、chunk expansion、vector metadata 仕様を確認する。
2. 既存互換の default eligible を保つ型と helper を追加する。
3. manifest 再確認で ACL / scope / active lifecycle 後に quality gate を通し、通常 RAG evidence から excluded を除外する。
4. lexical / semantic / memory / source chunk expansion の対象テストを追加または更新する。
5. docs と作業レポートを更新する。
6. targeted tests、typecheck、diff check、spec-recovery validation を実行する。
7. commit / push / PR 作成、受け入れ条件コメント、セルフレビューコメント後に task を done へ移動して追加 commit / push する。

## Documentation maintenance plan

- `docs/spec/gap-phase-c.md` に Phase C 実装結果と残した open question を追記する。
- README、API examples、OpenAPI、運用 docs は変更要否を確認し、必要なら更新する。不要な場合は report に理由を記録する。

## 受け入れ条件

- [ ] `DocumentQualityProfile` と verification / freshness / supersession / extraction quality / rag eligibility の enum が型として追加され、`DocumentLifecycleStatus` と分離されている。
- [ ] 既存文書互換として quality profile 未指定は通常 RAG で eligible 相当に扱われる。
- [ ] 明示 `ragEligibility: excluded` など quality gate 不合格の文書は通常 RAG evidence から除外される。
- [ ] lexical index、semantic vector hit 再確認、memory hit、memory source chunk expansion に同じ quality-approved 判定が通る。
- [ ] ACL、search scope、active lifecycle、`minScore`、sufficient context、citation validation、answer support verification の既存挙動を弱めていない。
- [ ] user-facing response に権限外文書や詳細な quality exclusion reason を漏らさず、diagnostics は安全な集計に限定されている。
- [ ] S3 Vectors filterable metadata 2,048 bytes budget を守り、詳細 profile を vector metadata に丸ごと載せていない。
- [ ] `docs/spec/gap-phase-c.md` に実装結果と残 open question が追記されている。
- [ ] `reports/working/*c-knowledge-quality-axes*.md` に作業レポートが作成されている。
- [ ] main 向け PR が作成され、日本語 PR 本文、受け入れ条件コメント、セルフレビューコメントが追加されている。
- [ ] PR コメント後に task md が `tasks/done/` に移動され、状態 `done` に更新されている。

## 検証計画

必須:

- `npm run typecheck -w @memorag-mvp/api`
- `git diff --check`
- `python3 scripts/validate_spec_recovery.py docs/spec-recovery`

対象テスト:

- `npm exec -w @memorag-mvp/api -- tsx --test src/agent/graph.test.ts src/agent/nodes/node-units.test.ts src/rag/memorag-service.test.ts src/adapters/s3-vectors-store.test.ts`

変更範囲に応じて追加:

- `npm run test -w @memorag-mvp/api`

## PR review points

- quality gate が ACL / scope / lifecycle の代替になっていないこと。
- quality-excluded の存在や詳細 reason が user-facing response に出ていないこと。
- vector metadata に詳細 profile を載せていないこと。
- benchmark / dataset 固有値が本番実装に入っていないこと。

## Risks / open questions

- `eligible_with_warning` は warning UI/API schema が未整備のため、通常 RAG で使うか除外するかを最小実装で明記する。
- quality profile の source of truth は初期実装では manifest 側を優先するが、将来の監査・更新 API では別 store が必要になる可能性がある。
- memory source chunk expansion の全経路を完全に追えない場合は、該当箇所と理由を docs/report/PR に open_question として記録する。
