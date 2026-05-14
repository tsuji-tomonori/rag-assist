# 章別仕様 canonical docs

このディレクトリは、`rag-assist` の章別仕様と、章別仕様から派生する traceability / REQ map を管理する。

## 正本

- canonical 仕様: `docs/spec/2026-chapter-spec.md`
- 入力元: `.workspace/rag-assist_仕様追加_章別定義_管理者向け構成版 (1).md`
- 入力元確認値: 11,799 行 / 508,290 bytes

`docs/spec/2026-chapter-spec.md` は、Phase A1 時点で入力元を内容編集せずにコピーしたものである。
今後の task md、PR 本文、レビューコメントでは、`.workspace/` ではなくこの canonical 仕様を参照する。

## 派生成果物

次のファイルは canonical 仕様から派生する成果物として扱う。

- `docs/spec/gap-phase-a.md`: Phase A-pre のギャップ・影響範囲調査。
- `docs/spec/CHAPTER_TO_REQ_MAP.md`: 章 ID から既存 REQ / planning REQ / spec-recovery / 実装ファイルへの対応表。Phase A2 で作成する。
- `docs/spec-recovery/08_traceability_matrix.md`: 既存作業レポート起点の traceability matrix。Phase A2 以降で章 ID との接続を延伸する。
- `docs/1_要求_REQ/`: 1 要件 1 ファイルを正とする要求仕様。章別仕様の新規・不足範囲は planning 状態の REQ 雛形として追加する。

## 章 ID の扱い

- `0`, `1`, `2` のような番号章と、`1A`, `3A`, `4B`, `21A` のような派生章を区別せず、章 ID として扱う。
- 章 ID は後続 task md の `仕様参照` と PR レビュー観点で使う。
- 章 ID から要件・実装へ直接たどるための正規 map は `docs/spec/CHAPTER_TO_REQ_MAP.md` とする。
- 初回 map では全章を網羅することを優先し、節単位の詳細 map は必要な Phase で追加する。

## 更新ルール

- canonical 仕様本文を変更する場合は、変更理由、影響する章 ID、対応する REQ / 実装 / 検証を PR 本文に記載する。
- 既存 `FR-*` / `NFR-*` は renumber しない。章別仕様との対応は map 側で表現する。
- 仕様に明記されていない既存挙動は、各 Phase の `*-pre-gap` task で `docs/spec/gap-<phase>.md` または `docs/spec-recovery/09_gap_analysis.md` に記録してから実装 task へ進む。
- 実施していない検証、未作成の REQ、未実装機能を完了扱いしない。

## 検証

このディレクトリだけを対象にする専用 validator はまだ存在しない。
Phase A1 では次を最小検証とする。

```bash
wc -l -c docs/spec/2026-chapter-spec.md
python3 scripts/validate_spec_recovery.py docs/spec-recovery
git diff --check
```

Phase A2 では `docs/spec/CHAPTER_TO_REQ_MAP.md` の章網羅を確認する補助チェックを追加する。
