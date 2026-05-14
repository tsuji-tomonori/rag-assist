# A1 docs spec canonical 化
状態: do
タスク種別: ドキュメント更新
発注元 wave: Wave 1
依存タスク: `tasks/done/20260514-1315-phase-a-pre-gap.md`

## 背景

Phase A-pre で、章別仕様書が `.workspace/` 配下の未追跡入力に留まり、`docs/spec/` に canonical 仕様が存在しないことを確認した。
後続 A2 で章 ID から REQ / 実装ファイルへの map を作るには、PR 内で参照可能な安定した仕様ファイルが必要である。

## スコープ

- 含む:
  - `.workspace/rag-assist_仕様追加_章別定義_管理者向け構成版 (1).md` を `docs/spec/2026-chapter-spec.md` に canonical コピーする。
  - `docs/spec/README.md` を追加し、canonical 仕様、派生 docs、章 ID、後続更新ルールを明記する。
  - 作業レポートを `reports/working/` に残す。
- 含まない:
  - `docs/spec/CHAPTER_TO_REQ_MAP.md` の作成。A2 の成果物とする。
  - 新規 REQ 雛形の作成。A2 の成果物とする。
  - 章別仕様本文の内容編集、章分割、要約化。
  - 元 `.workspace/` ファイルの削除または移動。

## 実装計画

1. 入力元仕様ファイルの行数・サイズを確認する。
2. `docs/spec/2026-chapter-spec.md` に機械的コピーする。
3. `docs/spec/README.md` を追加し、正本・派生成果物・更新手順・検証方法を整理する。
4. `git diff --check` と `python3 scripts/validate_spec_recovery.py docs/spec-recovery` を実行する。
5. 作業レポートを作成し、commit / push / PR / コメントまで進める。

## ドキュメント更新計画

- `docs/spec/2026-chapter-spec.md`: canonical 章別仕様書。
- `docs/spec/README.md`: 仕様ファイルの扱い、章 ID、後続 A2 への引き継ぎ、検証の限界を記載。
- `reports/working/20260514-1421-a1-docs-spec-canonical.md`: 作業完了レポート。

## 受け入れ条件 (acceptance criteria)

- [x] 章別仕様書が `docs/spec/2026-chapter-spec.md` に配置され、参照元と行数が確認できる。
  - 根拠: `wc -l -c` で canonical と入力元がどちらも 11,799 行 / 508,290 bytes。
- [x] `docs/spec/README.md` に canonical 仕様と派生 docs の関係が明記されている。
  - 根拠: `docs/spec/README.md` の「正本」「派生成果物」。
- [x] A2 の `CHAPTER_TO_REQ_MAP.md` 作成が後続 task として明確に scope-out されている。
  - 根拠: 本 task md の scope-out と `docs/spec/README.md` の「派生成果物」「検証」。
- [x] `python3 scripts/validate_spec_recovery.py docs/spec-recovery` の結果が記録されている。
  - 根拠: pass。出力は `Validation completed. Review warnings before treating the spec recovery as complete.`。
- [x] `git diff --check` が pass している。
  - 根拠: `git diff --check` pass。

## 検証計画

- 実行コマンド:
  - `wc -l -c docs/spec/2026-chapter-spec.md`
  - `python3 scripts/validate_spec_recovery.py docs/spec-recovery`
  - `git diff --check`
- 期待結果:
  - canonical 仕様ファイルが入力元と同じ 11,799 行である。
  - 既存 spec recovery validator が pass する。
  - Markdown の末尾空白や conflict marker がない。

## PR レビュー観点

- 仕様本文を編集せず、入力元を canonical docs へ固定しているか。
- README が A2 以降の章 map / REQ 更新を迷わせないか。
- 未実施の map 作成や REQ 雛形作成を完了扱いしていないか。

## リスク・open questions

- 仕様ファイルは約 50 万 bytes と大きいため PR diff が大きくなる。
- 章別仕様の章間表記揺れは本タスクでは解決しない。A2 の map 作成時に canonical 章を決める。
