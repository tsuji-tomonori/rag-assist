# 問い合わせ管理の機能要求拡充

保存先: `tasks/done/20260507-2207-expand-question-requirements.md`

## 状態

- done

## 背景

`FR-021` は回答不能質問の問い合わせ登録、担当者回答、通知、履歴表示、本人解決済み化など複数の振る舞いを 1 ファイルに集約している。
過去の task と reports では、担当者対応のカンバン UI、通常利用者の問い合わせ後 403 修正、問い合わせ結果の履歴通知、HITL feedback loop 候補が個別に記録されているため、問い合わせ管理要件を 1 要件 1 ファイルの粒度へ拡充する。

## 目的

`memorag-bedrock-mvp/docs/1_要求_REQ/11_製品要求_PRODUCT/01_機能要求_FUNCTIONAL/06_問い合わせ・人手対応/01_問い合わせ管理/` を、過去の実装・task・report に沿って読みやすく検証可能な機能要求群へ整理する。

## 対象範囲

- `FR-021` と同じ L1/L2 配下の機能要求ファイル
- 機能要求分類索引 `01_機能要求_FUNCTIONAL/README.md`
- 要件変更管理 `REQ_CHANGE_001.md`
- 作業完了レポート `reports/working/`

## 方針

- `FR-021` は回答不能時の問い合わせ登録に絞る。
- 担当者カンバン、検索・絞り込み、回答作成、利用者通知、履歴状態表示、本人解決済み化、HITL 候補管理を個別 `FR-*` に分ける。
- 既に実装・検証された振る舞いと、将来拡張に近い HITL feedback loop を状態・背景で区別する。
- 要求文は「何を満たすか」に集中し、API や UI の実装手段は受け入れ条件や関連文書へ留める。

## 実行計画

1. 過去 task / reports / docs から問い合わせ管理に関係する根拠を確認する。
2. `FR-021` を問い合わせ登録の要件へ整理する。
3. `FR-031` 以降の問い合わせ管理要件を追加する。
4. 機能要求分類索引と変更管理トレーサビリティを更新する。
5. docs 変更として `git diff --check` と `pre-commit run --files <changed-files>` を実行する。
6. 作業完了レポートを `reports/working/` に保存する。
7. commit / push / PR 作成 / 受け入れ条件確認コメント / セルフレビューコメントまで行う。
8. PR コメント後に task を `tasks/done/` へ移動し、状態を `done` に更新する。

## ドキュメントメンテナンス計画

- 今回の成果物自体が durable docs の更新である。
- API、データ設計、HLD/DLD は既存記述と整合する範囲の要件分割であり、挙動追加はしないため更新不要と判断する。
- HITL feedback loop は既存 todo task の内容を要件候補として記載するが、未実装の運用・API を実装済み扱いしない。

## 受け入れ条件

- `FR-021` が回答不能時の問い合わせ登録に絞られていること。
- 問い合わせ管理配下に、カンバン、検索・絞り込み、回答作成、利用者通知、履歴状態表示、本人解決済み化、HITL 候補管理の要件が 1 要件 1 ファイルで追加されていること。
- 各要件ファイルに要件文、専用受け入れ条件、源泉・背景、目的・意図、関連文書があること。
- 過去 task / reports の要点が源泉・背景に反映されていること。
- 機能要求分類索引と `REQ_CHANGE_001.md` の問い合わせ・人手対応トレーサビリティが更新されていること。
- 未実装または将来拡張の HITL feedback loop を実装済みとして記載していないこと。
- 実施した検証だけを作業レポート、PR 本文、PR コメント、最終回答に記載すること。

## 検証計画

- `git diff --check`
- `pre-commit run --files <changed-files>`
- 必要に応じて `rg` で `FR-031` 以降の索引・トレーサビリティ整合を確認する。

## PRレビュー観点

- `blocking`: 1 要件 1 ファイルの原則に反して複合要件を残していないこと。
- `blocking`: 未実装の HITL feedback loop を実装済み要件のように読ませていないこと。
- `should fix`: 索引と個別ファイルの `FR-*` ID、L1/L2、要旨が一致していること。
- `should fix`: 問い合わせ機能の権限境界を弱める要求になっていないこと。

## 未決事項・リスク

- 決定事項: 今回は docs の要件整理であり、API / Web / Store の実装変更は行わない。
- リスク: `FR-031` 以降の番号が並行 PR と競合する場合は main 取り込み時に再採番が必要になる。

## 完了確認

- PR: `https://github.com/tsuji-tomonori/rag-assist/pull/178`
- 作業 commit: `db71d52`
- CI 修正 commit: 本 task 更新を含む後続 commit
- 受け入れ条件確認コメント: `4397445298`
- セルフレビューコメント: `4397447204`
- 検証: `git diff --check` pass
- 検証: `git ls-files --modified --others --exclude-standard -z | xargs -0 pre-commit run --files` 初回自動修正後、再実行 pass
- PR CI の API test failure 原因: `FR-031` から `FR-037` を追加したが、`requirements-coverage.test.ts` の coverage map に新規 FR を追加していなかった。
- PR CI 修正後の検証: `npm ci` pass
- PR CI 修正後の検証: `npm run test:coverage -w @memorag-mvp/api` pass
- PR CI 修正後の検証: `npm exec -- eslint apps/api --cache --cache-location .eslintcache-api --max-warnings=0` pass
- PR CI 修正後の検証: `npm run typecheck -w @memorag-mvp/api` pass
