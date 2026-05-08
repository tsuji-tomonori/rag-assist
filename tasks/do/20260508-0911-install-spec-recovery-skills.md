# 仕様復元 Codex skill パック導入

状態: do

## 背景

ユーザーから、作業レポート起点の要件復元・受け入れテスト駆動の仕様化・トレーサビリティ付き欠落分析を行う Codex skill パック `rag-assist-codex-skills.zip` の導入を依頼された。

## 目的

`rag-assist` リポジトリで、仕様復元 workflow を再利用できるように skill、テンプレート、検証スクリプト、導入ドキュメントを配置する。

## スコープ

- zip 内容の安全確認
- リポジトリローカル skill と関連 docs/scripts の導入
- AGENTS.md や既存 skill との整合確認
- 導入物に対する最小十分な検証
- commit、push、PR 作成、PR コメント、作業レポート作成

## 計画

1. zip のファイル一覧と導入スクリプトを確認する。
2. 既存の agent/skill 構成に合う配置へ導入する。
3. 必要に応じて README、AGENTS.md、docs、scripts を調整する。
4. 変更範囲に応じた検証を実行する。
5. 作業レポート、commit、PR、受け入れ条件コメント、セルフレビューコメントを完了する。

## ドキュメント保守計画

- agent workflow に影響する場合は `AGENTS.md` を確認し、必要最小限の更新に留める。
- 仕様復元の利用方法は導入される README または `docs/spec-recovery/` の index で追える状態にする。
- 一時的な作業記録は `reports/working/` に残す。

## 受け入れ条件

- [ ] zip 内の想定外パスや危険な上書きがないことを確認している。
- [ ] 仕様復元 skill 群が repository-local skill として利用可能な場所に配置されている。
- [ ] `docs/spec-recovery/` と `scripts/validate_spec_recovery.py` が導入され、使い方が追える。
- [ ] AGENTS.md または README から、導入した workflow の位置づけが分かる。
- [ ] 変更範囲に対して選定した検証が実行され、結果が記録されている。
- [ ] PR 作成後、受け入れ条件確認コメントとセルフレビューコメントを日本語で投稿している。
- [ ] 作業完了レポートを `reports/working/` に保存している。

## 検証計画

- `git diff --check`
- 変更した `SKILL.md` の frontmatter とリンク/パスの目視確認
- `python3 -m py_compile scripts/validate_spec_recovery.py`
- `python3 scripts/validate_spec_recovery.py docs/spec-recovery`
- 可能なら `pre-commit run --files <changed-files>`

## PR レビュー観点

- repository-local skill としての配置が既存ルールと矛盾しないこと
- README/AGENTS/docs の説明が過剰に重複していないこと
- 未実施の検証を実施済み扱いしていないこと
- RAG 品質・セキュリティ観点が仕様復元 workflow に含まれていること

## リスク

- zip 付属の install script が repo の既存ファイルを広く上書きする可能性があるため、実行前に内容を確認する。
- GitHub Apps connector が利用できない場合、PR 作成やコメント投稿は `gh` fallback または blocked 扱いにする。
