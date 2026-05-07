# neoAI Chat 比較ロードマップの task 化

保存先: `tasks/done/20260507-2000-neoai-roadmap-tasking.md`

## 状態

- done

## 背景

ユーザーは、接続済み GitHub 上の `tsuji-tomonori/rag-assist`、特に `memorag-bedrock-mvp` を比較対象として、neoAI Chat の公開情報ベースで整理した改善ロードマップを `tasks` に入れるよう依頼した。外部 Web はこの環境では再確認しない前提で、rag-assist 側はリポジトリ実体と既存 task に合わせて整理する必要がある。

## 目的

neoAI Chat から取り入れるべき改善領域を、将来の実装 PR でそのまま着手できる `tasks/todo/*.md` に分解する。

## 対象範囲

- `tasks/todo/`
- `tasks/do/`
- `reports/working/`

## 方針

- `skills/task-file-writer/SKILL.md` の required sections に合わせる。
- ユーザーのロードマップを、評価基盤、構造化 ingestion、blue-green benchmark gate、Assistant Profile、HITL、評価駆動の高度検索に分ける。
- 既存 task と重なる内容は依存関係として参照し、同一目的の重複 task を増やさない。
- neoAI Chat 側の情報は前回調査ベースの前提として扱い、外部 Web での再確認済みとは書かない。

## 必要情報

- ユーザー提供の比較・ロードマップ本文。
- 既存 task:
  - `tasks/todo/20260506-1203-rag-policy-profile.md`
  - `tasks/todo/20260506-1203-benchmark-evaluator-profiles.md`
  - `tasks/todo/20260506-2049-mmrag-docqa-production-dataset.md`

## 実行計画

1. 既存の task 形式と重複候補を確認する。
2. ロードマップを独立した実装成果ごとに分解する。
3. 各 task に背景、目的、対象範囲、方針、受け入れ条件、検証計画、PRレビュー観点、リスクを書く。
4. Markdown の保存先と状態を確認する。
5. `git diff --check` で基本的な Markdown 差分を検証する。
6. 作業完了レポートを `reports/working/` に残す。

## ドキュメントメンテナンス計画

- 今回は将来作業の task 化であり、実装挙動、API、運用手順は変更しない。
- 各 future task には、実装時に README、`memorag-bedrock-mvp/docs/`、API examples、OpenAPI、local verification、operations への影響を確認する計画を含める。
- PR 本文では、今回は task 追加のみで製品挙動のドキュメント更新は不要であることを明記する。

## 受け入れ条件

- ユーザーのロードマップが、複数の実行可能な `tasks/todo/*.md` に分解されている。
- 各 task が required sections を持つ。
- 各 task に受け入れ条件と検証計画がある。
- neoAI Chat 側の情報を外部 Web 再確認済みとして扱っていない。
- 既存 task と重なる領域は依存関係または関連情報として記載されている。
- `git diff --check` が通る。

## 検証計画

- `git diff --name-only`
- `git diff --check`
- 作成した `tasks/todo/*.md` の保存先と状態の目視確認

## PRレビュー観点

- 1 task 1 outcome になっていること。
- task が具体的な受け入れ条件を持ち、将来の実装者が検収できること。
- 実施していない外部 Web 調査や benchmark を実施済みとして書いていないこと。
- 既存 task と衝突せず、依存関係が明記されていること。

## 未決事項・リスク

- 決定事項: 今回は task 作成に限定し、`memorag-bedrock-mvp` の実装や docs 本体は変更しない。
- 決定事項: neoAI Chat 側の前提はユーザー提示の前回調査ベースとして扱う。
- リスク: 将来の実装時には、最新の製品仕様、AWS 構成、benchmark 結果を再確認する必要がある。

## 完了メモ

- PR: `https://github.com/tsuji-tomonori/rag-assist/pull/153`
- 受け入れ条件確認コメント: PR #153 に投稿済み。
- セルフレビューコメント: PR #153 に投稿済み。
- 検証: `git diff --check`、`git diff --cached --check`、commit 時 pre-commit hook が pass。
