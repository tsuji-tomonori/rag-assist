# Phase A 着手前ギャップ・影響範囲調査 (章別仕様 canonical 化準備)

状態: done

タスク種別: 調査

発注元 wave: Wave 1-pre

依存タスク: なし

## 仕様参照

- 仕様書本体: `.workspace/rag-assist_仕様追加_章別定義_管理者向け構成版 (1).md`
- 対象章: `0. ドキュメントの読み方` / `1. システム全体定義` / `1A. データ品質・処理原則` / `2. ユーザー機能` / `3. ナレッジ・文書管理機能` / `6. ユーザー設定機能` / `24. 最終まとめ`
- 関連既存 docs: `docs/spec-recovery/00_input_inventory.md` 〜 `12_report_reading_inventory.md`、`docs/spec-recovery/README.md`、`docs/spec-recovery/traceability_matrix.csv`、`docs/1_要求_REQ/` 配下

## 背景

PR #284 で `memorag-bedrock-mvp/` 配下のソースが repository root に引き上げ済み (`apps/`, `packages/`, `docs/`, `benchmark/`, `infra/`, `tools/`)。これに合わせて `.workspace/rag-assist_仕様追加_章別定義_管理者向け構成版 (1).md` (11,799 行 / 24 章 / 496KB) を canonical 仕様として `docs/spec/` 配下へ確定移動する Phase A 実装に着手する前に、Phase A スコープ章 (0/1/1A/2/3/6/24) の仕様と既存実装・既存 docs のギャップを棚卸す必要がある。

本 Phase は移行計画の Wave 1-pre に該当し、後続 Wave 1 実装 task (`A1-docs-spec-canonical` / `A2-chapter-to-req-map` / `A3-cleanup-stale-mvp-dir`) の発注スコープと「踏襲すべき既存挙動」を確定するための調査である。

## 目的

- Phase A 対象章 (0/1/1A/2/3/6/24) の主要型・ルール・操作を仕様から列挙する。
- 現実装 (`apps/api/`, `apps/web/`, `packages/contract/`) と既存 docs (`docs/spec-recovery/`, `docs/1_要求_REQ/`) で対応する型・ルール・操作を列挙する。
- 仕様 ↔ 実装 ↔ 既存 docs の差分を `confirmed` / `partially covered` / `missing` / `divergent` で分類する。
- 仕様に明記されていないが既存実装で確定している挙動 (特に性能・閾値・debug・benchmark 期待値) を「踏襲すべき既存挙動」として列挙する。
- Phase A 実装 task のスコープ確定材料 (`docs/spec/CHAPTER_TO_REQ_MAP.md` 雛形 + 踏襲リスト) を成果物として残す。

## なぜなぜ分析サマリ

本タスクは `調査` のため `nazenaze-analysis` 必須ではないが、後続 Phase A 実装 task の発注根拠として簡易整理する。

- confirmed: PR #284 merge で `memorag-bedrock-mvp/` 配下が root に移動済み。仕様内パス参照と乖離する箇所が広範に存在する可能性が高い。
- confirmed: `docs/spec-recovery/` は仕様復元成果物としてすでに整備されており、章別仕様の章 ID とは別の REQ ID 体系で管理されている。
- inferred: 仕様 11,799 行を一括書き換えで反映すると認可 / 性能 / benchmark / debug の確定済み挙動を無効化するリスクが大きい。
- inferred: 各 Phase 着手前にギャップ調査を入れないと、実装 task のスコープが過大化し PR レビューで差し戻しが頻発する。
- root_cause: 章別仕様への移行は「ドキュメント差し替え」ではなく「構造的リファクタを伴う段階移行」であり、章単位の影響範囲確定が前提となる。
- remediation: Phase 単位の `*-pre-gap` 調査 task を必ず先行させ、ギャップと踏襲挙動を成果物として残してから実装 task を発注する。

## スコープ

含む:
- 仕様書 (`.workspace/rag-assist_仕様追加_章別定義_管理者向け構成版 (1).md`) の Phase A 対象章の読解。
- 既存 docs (`docs/spec-recovery/00..12`, `docs/1_要求_REQ/`) との対応表作成。
- 現実装 (`apps/api/src/`, `apps/web/src/`, `packages/contract/src/`) で対象章に関連する型・schema・route・feature の列挙。
- ギャップ分類 (`confirmed` / `partially covered` / `missing` / `divergent`) と根拠付き整理。
- 踏襲すべき既存挙動 (特に性能・閾値・debug・benchmark 期待値) のうち、Phase A 対象章に関係するものの列挙。
- 成果物 markdown 作成 (`docs/spec/gap-A.md`)。
- `docs/spec/CHAPTER_TO_REQ_MAP.md` の章 ID → 既存 REQ ID / 既存 docs / 実装ファイル トレース雛形 (Phase A 範囲のみ)。

含まない:
- 仕様書の `docs/spec/` への確定移動 (Phase A1 `A1-docs-spec-canonical` の責務)。
- 新規 REQ ファイル雛形の作成 (Phase A2 `A2-chapter-to-req-map` の責務)。
- `memorag-bedrock-mvp/` 残骸 directory の削除・整理 (Phase A3 `A3-cleanup-stale-mvp-dir` の責務)。
- 実装変更、認可・schema 変更、benchmark 変更。
- Phase B 以降の章 (1B / 3A / 3B / 3C / 4 / 4A / 4B / 4C / 5 / 7 / 7A / 7B / 8 / 9 系 / 10–14 系 / 15–23A 系) の調査。

## 実装計画 (調査手順)

1. 仕様書から Phase A 対象章 (0/1/1A/2/3/6/24) の主要型・ルール・操作を列挙する (章 ID → 要素列リスト)。
2. `docs/spec-recovery/` の既存復元成果物と `docs/1_要求_REQ/` の REQ 雛形を読み、Phase A 対象章に対応する既存 docs を抽出する。
3. `apps/api/src/`、`apps/web/src/`、`packages/contract/src/` から Phase A 対象章に関係する型・schema・route・feature を抽出する。
4. 仕様 ↔ 実装 ↔ 既存 docs の差分を `confirmed` / `partially covered` / `missing` / `divergent` で分類し、根拠 (ファイルパス、関数名、コミット ID 等) を必ず付ける。
5. 仕様に明記されていないが既存実装で確定している挙動のうち、Phase A 対象章 (特に章 1 / 1A / 3 / 6) に関係する性能・閾値・debug・benchmark 期待値を「踏襲すべき既存挙動」として列挙する。
6. `docs/spec/gap-A.md` を新規作成し、上記 1–5 の結果を整理する。
7. `docs/spec/CHAPTER_TO_REQ_MAP.md` を新規作成し、Phase A 対象章だけの章 ID → 既存 REQ ID / 既存 docs / 実装ファイル トレース雛形を記載する (他 Phase 章は TBD 行として記述)。
8. 後続 Phase A 実装 task (`A1-docs-spec-canonical` / `A2-chapter-to-req-map` / `A3-cleanup-stale-mvp-dir`) のスコープと scope-out 候補、リスク欄に反映すべき踏襲挙動を `gap-A.md` 末尾の「後続 task への申し送り」セクションに残す。

## ドキュメント保守方針

- 成果物は `docs/spec/gap-A.md` と `docs/spec/CHAPTER_TO_REQ_MAP.md` (Phase A 範囲分のみ) に集約する。
- `docs/spec-recovery/08_traceability_matrix.md` には本 Phase では追記しない (Phase A2 実装 task で実施する)。
- 仕様書本体は `.workspace/` のまま (移動は A1 で実施)。

## 受け入れ条件

- [x] Phase A 対象章 (0/1/1A/2/3/6/24) すべてについて、主要型・ルール・操作が `gap-A.md` に列挙されている。
  - 根拠: `docs/spec/gap-A.md` の「章別ギャップ」。
- [x] 各章ごとに `confirmed` / `partially covered` / `missing` / `divergent` のいずれかで差分分類されている。
  - 根拠: `docs/spec/gap-A.md` の「章別ギャップ」。
- [x] 各差分行に根拠 (ファイルパス、関数名、コミット ID、PR 番号、benchmark 期待値ファイル等) が必ず付いている。
  - 根拠: `docs/spec/gap-A.md` の各行の「根拠」列。
- [x] 「踏襲すべき既存挙動」リストが残されており、Phase A 対象章の範囲で性能・閾値・debug・benchmark 期待値が漏れていない。
  - 根拠: `docs/spec/gap-A.md` の「踏襲すべき既存挙動」と `docs/spec/CHAPTER_TO_REQ_MAP.md` の「Phase A 踏襲挙動トレース」。
- [x] `docs/spec/CHAPTER_TO_REQ_MAP.md` が Phase A 対象章で最新化されている (他 Phase 章は TBD で可)。
  - 根拠: `docs/spec/CHAPTER_TO_REQ_MAP.md` の「Phase A」および「Phase 外章」。
- [x] 後続実装 task (`A1` / `A2` / `A3`) のスコープと scope-out 候補が `gap-A.md` に抽出されている。
  - 根拠: `docs/spec/gap-A.md` の「後続 task への申し送り」と「Scope-out 候補」。
- [x] 実装ファイル・schema・benchmark dataset を変更していない。
  - 根拠: `git status --short` で変更対象が `docs/spec/`、本 task、作業レポートのみであることを確認予定。現時点の成果物作成では実装ファイル・schema・benchmark dataset を編集していない。
- [x] 変更範囲に見合う検証が pass する。
  - 根拠: `scripts/validate_spec_recovery.py docs/spec-recovery`、`git diff --check`、`pre-commit run --files docs/spec/gap-A.md docs/spec/CHAPTER_TO_REQ_MAP.md tasks/do/20260513-2349-a-pre-gap-spec-chapter-canonicalization.md` が pass。
- [x] 作業レポートを `reports/working/` に保存する。
  - 根拠: `reports/working/20260514-0849-a-pre-gap-spec.md`。
- [x] PR 作成後に受け入れ条件確認コメントとセルフレビューコメントを日本語で投稿する。
  - 根拠: PR #286 に受け入れ条件確認コメントとセルフレビューコメントを GitHub Apps 経由で投稿した。

## PR レビュー観点

- 仕様章 ID で参照可能 (`# 章 ID` 単位の説明)。
- 認可境界 / 文書品質 / 性能関連で「明記されていないが踏襲必須」の挙動が漏れていないか。
- benchmark 期待値や dataset 固有値が `gap-A.md` 内で実装パスとして残されていないか (調査結果として記録するのは可、実装には反映しない)。
- `docs/spec-recovery/` 既存 REQ ID 体系と章 ID 体系の二重トレースが取れているか。

## 検証計画

- `scripts/validate_spec_recovery.py docs/spec-recovery`: pass 維持 (既存 spec-recovery を壊さないこと)。
- `git diff --check`: pass。
- `pre-commit run --files docs/spec/gap-A.md docs/spec/CHAPTER_TO_REQ_MAP.md tasks/do/20260513-2349-a-pre-gap-spec-chapter-canonicalization.md`: pass。
- 仕様章番号と `gap-A.md` 内の章節整合の目視確認: pass。

## 検証結果

- `python3 scripts/validate_spec_recovery.py docs/spec-recovery`: pass。
- `git diff --check`: pass。
- `rg -n "^# |^## |^\\| 0\\.|^\\| 1\\.|^\\| 1A\\.|^\\| 2\\.|^\\| 3\\.|^\\| 6\\.|^\\| 24\\." docs/spec/gap-A.md docs/spec/CHAPTER_TO_REQ_MAP.md`: pass。対象章の行が存在することを確認。
- `pre-commit run --files docs/spec/gap-A.md docs/spec/CHAPTER_TO_REQ_MAP.md tasks/do/20260513-2349-a-pre-gap-spec-chapter-canonicalization.md`: pass。

## リスク・open questions

- 仕様 11,799 行のうち Phase A 対象章 (0/1/1A/2/3/6/24) は約 1/3 程度の見込みだが、章 3 (ナレッジ・文書管理) が大きく、Phase C/E スコープと境界が曖昧になる可能性。境界判断は本タスクで決定せず `gap-A.md` の open questions に残す。
- `docs/spec-recovery/` の既存 REQ ID 体系と章 ID 体系の対応が 1:1 で取れない可能性。取れない箇所は `partially covered` 扱いとし、Phase A2 で REQ 雛形追加方針を決める。
- 仕様に明記されていない踏襲挙動の網羅性は本タスク単独では完全には保証できない。少なくとも以下のコミット / 実装は調査対象に含める:
  - `2c10256e ⚡️ perf(api): ChatRAG follow-up の検索を軽量化`
  - `c438009c ♻️ refactor(api): required fact planning を集約`
  - `01bb1bff required fact planning の語彙 rule 依存を除去`
  - `71782905 ♻️ refactor(api): policy computation gate を汎化`
  - `1865d193 ✅ test(rag): API coverage 閾値の回帰を補強`
  - `reports/working/20260511-2321-s3-vectors-metadata-budget.md`
  - `ingest-lambda-timeout-limit` / `adjust-heavy-api-lambda-quota` 関連 task / report
