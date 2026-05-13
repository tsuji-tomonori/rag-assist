# README 簡潔化と仕様復元 workflow 削除

- 状態: in_progress
- ブランチ: `codex/simplify-readme-remove-spec-workflow`
- タスク種別: ドキュメント更新

## 背景

ユーザーから、README をシンプルにし、必要に応じて各種ドキュメントのリンクにとどめること、さらに仕様復元 workflow を削除することを依頼された。

## 目的

ルート README を入口として読みやすい構成へ短縮し、仕様復元 workflow の運用導線と成果物をリポジトリから削除する。

## スコープ

- ルート `README.md` の簡潔化
- 仕様復元 workflow に関する repository-local skill、成果物、検証 script、AGENTS.md 記述の削除
- README から必要な durable docs へのリンク整理
- 変更範囲に見合う Markdown / 差分検証

## 計画

1. `README.md` と仕様復元関連ファイル・参照を確認する。
2. README を概要、主要リンク、起動/検証の最小導線へ整理する。
3. 仕様復元 workflow の skill、`docs/spec-recovery/`、validator、AGENTS.md の該当 section を削除する。
4. `rg` と `git diff --check` で残存参照・Markdown 差分を確認する。
5. 作業レポート、commit、PR、受け入れ条件コメント、セルフレビューコメントまで進める。

## ドキュメント保守方針

README 自体が主対象。既存の詳細ドキュメントは削除せず、README から必要なリンクを張る。仕様復元 workflow の durable 成果物・運用導線は削除対象とする。

## 受け入れ条件

- [x] AC-001: ルート `README.md` が詳細説明を抱え込まず、概要と主要ドキュメントへのリンク中心になっている。
- [x] AC-002: 仕様復元 workflow の導線が README / AGENTS.md から削除されている。
- [x] AC-003: 仕様復元 workflow 専用の `docs/spec-recovery/`、関連 skill、validator script が削除されている。
- [x] AC-004: 変更後に仕様復元 workflow の実行を促す通常導線が残っていないことを検索で確認している。
- [x] AC-005: Markdown / diff 向けの最小検証が pass している。

## 検証計画

- `rg -n "仕様復元|spec-recovery|rag-assist-spec-completion|validate_spec_recovery|..." README.md AGENTS.md docs skills`
- `git diff --check`
- `git diff --cached --check`
- `pre-commit run --files <changed-files>`

## 検証結果

- `rg -n "仕様復元|spec-recovery|rag-assist-spec-completion|validate_spec_recovery|..." README.md AGENTS.md docs skills`: pass。通常導線には残存なし。task md 内の依頼記録は対象外。
- `git diff --check`: pass
- `git diff --cached --check`: pass
- `pre-commit run --files <changed-files>`: pass

## PR レビュー観点

- README が入口として短く、詳細は既存 docs へ委譲されているか。
- 仕様復元 workflow の削除が過去 task/report の履歴証跡を不必要に書き換えていないか。
- 実装や RAG runtime の挙動変更を含んでいないことが明確か。

## リスク

- 過去の task/report/docs には仕様復元への履歴参照が残る可能性がある。運用導線ではなく履歴証跡のため、通常導線から外れているかを確認対象にする。
