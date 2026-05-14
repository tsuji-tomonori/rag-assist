# A2 章から REQ への対応表作成
状態: do
タスク種別: ドキュメント更新
発注元 wave: Wave 1
依存タスク: `tasks/done/20260514-1421-a1-docs-spec-canonical.md`

## 背景

A1 で章別仕様書を `docs/spec/2026-chapter-spec.md` として canonical 化した。
後続 Phase B-J/G の task md が章 ID を安定参照できるよう、全章 ID から既存 REQ、planning REQ、spec-recovery、主要実装ファイルへの対応表を作る必要がある。

## スコープ

- 含む:
  - `docs/spec/CHAPTER_TO_REQ_MAP.md` の作成。
  - 全 top-level 章 ID の網羅。
  - 既存 FR / NFR / SQ / TC / spec-recovery / 実装ファイルとの対応を `confirmed` / `inferred` / `missing` / `divergent` で分類。
  - 4B / 4C / 6A / 16-20 / 14B / 14C / 14D の planning REQ 雛形追加。
  - `docs/spec-recovery/08_traceability_matrix.md` への Phase A2 追記。
- 含まない:
  - planning REQ の詳細本文完成。
  - Phase B 以降の実装変更。
  - 既存 FR / NFR 番号の renumber。

## 実装計画

1. `docs/spec/2026-chapter-spec.md` から top-level 章 ID を抽出する。
2. 既存 `docs/REQUIREMENTS.md` と機能要求 / 非機能要求の索引を確認する。
3. `docs/spec/CHAPTER_TO_REQ_MAP.md` に全章 map を作る。
4. planning REQ 雛形を不足領域に追加する。
5. `docs/spec-recovery/08_traceability_matrix.md` に Phase A2 の traceability 行を追加する。
6. 章 ID 網羅を shell check で確認する。
7. spec recovery validator と `git diff --check` を実行する。

## ドキュメント更新計画

- `docs/spec/CHAPTER_TO_REQ_MAP.md`: 新規作成。
- `docs/spec-recovery/08_traceability_matrix.md`: Phase A2 行を追記。
- `docs/1_要求_REQ/...`: planning REQ 雛形を追加。
- `reports/working/20260514-1432-a2-chapter-to-req-map.md`: 作業完了レポート。

## 受け入れ条件 (acceptance criteria)

- [x] `docs/spec/2026-chapter-spec.md` の全 top-level 章 ID が `docs/spec/CHAPTER_TO_REQ_MAP.md` に出現している。
  - 根拠: 固定文字列検索による章網羅確認で欠落なし。
- [x] 既存 FR/NFR/SQ/TC と対応できる章は既存要件を参照し、不足領域は planning REQ として区別されている。
  - 根拠: `docs/spec/CHAPTER_TO_REQ_MAP.md` の対応表と Planning REQ 一覧。
- [x] 4B / 4C / 6A / 16-20 / 14B / 14C / 14D の planning REQ 雛形が追加されている。
  - 根拠: `FR-049` から `FR-055` の planning REQ。
- [x] `docs/spec-recovery/08_traceability_matrix.md` に Phase A2 の traceability 行が追加されている。
  - 根拠: `TASK-A2-CHAPTER-REQ-MAP` 行。
- [x] `python3 scripts/validate_spec_recovery.py docs/spec-recovery` の結果が記録されている。
  - 根拠: pass。出力は `Validation completed. Review warnings before treating the spec recovery as complete.`。
- [x] `git diff --check` が pass している。
  - 根拠: `git diff --check` pass。

## 検証計画

- 実行コマンド:
  - `rg -n '^# ' docs/spec/2026-chapter-spec.md`
  - `rg -n '^\\| (0|1|1A|...) ' docs/spec/CHAPTER_TO_REQ_MAP.md` 相当の章網羅確認
  - `python3 scripts/validate_spec_recovery.py docs/spec-recovery`
  - `git diff --check`
- 期待結果:
  - top-level 章 ID が map に全て含まれる。
  - spec recovery validator が pass する。
  - Markdown の末尾空白や conflict marker がない。

## PR レビュー観点

- 章 ID が欠落していないか。
- 既存 REQ を renumber せず、planning REQ と既存 REQ を混同していないか。
- 実装が missing / divergent の章を confirmed として扱っていないか。
- 後続 Phase B-J/G の task md が参照できる粒度になっているか。

## リスク・open questions

- 初回 map は章単位を優先するため、節単位の詳細 trace は後続 Phase で追加する。
- 章別仕様の用語と既存 MVP 要件の分類が一致しない箇所は `divergent` として残す。
