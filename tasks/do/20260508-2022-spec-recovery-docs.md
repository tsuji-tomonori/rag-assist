# docs/spec-recovery から MemoRAG docs への反映

- 状態: in_progress
- 作成日: 2026-05-08
- ブランチ: `codex/spec-recovery-docs`

## 背景

`docs/spec-recovery` で復元された要求・仕様・受け入れ条件を、耐久ドキュメントである `memorag-bedrock-mvp/docs` 配下へ反映する。

## 目的

`memorag-bedrock-mvp/docs` の SWEBOK-lite 構成に合わせて、未反映の要求を原子的な 1 要件 1 ファイルとして追加または更新する。

## スコープ

- `docs/spec-recovery/06_requirements.md`
- `docs/spec-recovery/07_specifications.md`
- `docs/spec-recovery/03_acceptance_criteria.md`
- `docs/spec-recovery/09_gap_analysis.md`
- `memorag-bedrock-mvp/docs` 配下の要求索引、機能要求、非機能要求、品質制約、変更管理

## 作業計画

1. 既存 `memorag-bedrock-mvp/docs` と `docs/spec-recovery` の差分を確認する。
2. 未反映の要求を、既存分類と重複しない原子的な要件へ分割する。
3. 各要件ファイルに専用の受け入れ条件と源泉を記載する。
4. `REQUIREMENTS.md`、機能要求索引、変更管理トレーサビリティを更新する。
5. Markdown 差分と docs check を検証する。
6. 作業レポート、commit、push、PR、受け入れ条件コメント、セルフレビューコメントまで完了する。

## ドキュメント保守方針

- 要件本文は `memorag-bedrock-mvp/docs/1_要求_REQ/` 配下の分割ファイルを正とする。
- 複合要求は 1 actor / 1 intent / 1 observable outcome へ分ける。
- `REQUIREMENTS.md` は索引として更新し、要求本文を重複させない。
- `docs/spec-recovery` 側は今回の入力として扱い、仕様復元そのものの再生成は行わない。

## 受け入れ条件

- AC-001: `docs/spec-recovery` 後半で未反映だった要求が、`memorag-bedrock-mvp/docs` に原子的な要件ファイルとして追加または既存要件へ補完されている。
- AC-002: 各追加・更新要件は、同一ファイル内にその要件専用の受け入れ条件を持つ。
- AC-003: `memorag-bedrock-mvp/docs/REQUIREMENTS.md`、機能要求分類索引、変更管理トレーサビリティが追加・更新要件と矛盾しない。
- AC-004: 実行した検証と未実施検証が、作業レポート、PR 本文、PR コメントで実施済みとして誤記されていない。
- AC-005: PR 作成後、受け入れ条件確認コメントとセルフレビューコメントが日本語で投稿されている。

## 検証計画

- `git diff --check`
- `task docs:check` または利用可能な最小 docs validation
- 必要に応じて `pre-commit run --files <changed-files>`

## PR レビュー観点

- 1 要件 1 ファイルと受け入れ条件の粒度が守られているか。
- `docs/spec-recovery` の source/confidence を過剰に断定していないか。
- RAG の根拠性、回答不能制御、認可境界、benchmark dataset 固有値の禁止が弱まっていないか。
- 既存 `FR-*` / `NFR-*` / `SQ-*` との重複や矛盾がないか。

## リスク

- 既存要件の一部はすでに同等内容を含むため、重複を避けるために追加対象を絞る必要がある。
- `docs/spec-recovery` の gap 項目には未確定値が含まれるため、具体閾値は未確定として扱う。
