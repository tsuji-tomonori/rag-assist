# 実装ベース仕様漏れ確認 作業レポート

- 作成日時: 2026-05-12 14:04
- 対象: `.workspace/rag-assist_仕様追加_ナレッジ品質_高度文書解析_統合版.md`
- 成果物: `.workspace/rag-assist_仕様追加_統合版_実装ベース未記載追補.md`

## 指示

「ほかにないか実装をベースに確認して /plan」

## 要件整理

- 既存の2本の追補を前提に、さらに実装側から漏れた機能・処理を確認する。
- 特に回答生成周辺について、前回の整理で漏れた項目や状態更新が必要な項目を確認する。
- commit は不要。
- 成果物は `.workspace/` に書き出す。

## 実施作業

- route 実装、agent node、RAG pipeline、benchmark runner、Web hook / debug utility を確認した。
- 既存追補の見出しを確認し、重複ではなく追加・状態更新になる項目を抽出した。
- 実装根拠付きで 13 件の追補項目を `.workspace` に作成した。

## 成果物要約

追加で仕様化すべき項目:

- Chat / document ingest の SSE 再接続 contract。
- Document upload session の local content endpoint と purpose 別認可。
- Document group sharing API と scoped metadata。
- Alias lifecycle の update / disable / audit-log。
- Typed claim conflict が実装済みであることの状態更新。
- 参照ラベル抽出・解決 node。
- PDF / DOCX / Textract 抽出の fallback と structured block 化。
- Pipeline version と runtime policy の中央管理。
- Debug trace replay envelope v2。
- Clarification freeform の UI 文脈保持。
- Benchmark evaluation schema の実装粒度。
- Access-control static policy gate。
- Requirements coverage gate。

## Fit 評価

- ユーザーの「実装をベースに確認」に対し、実装ファイルを直接確認して根拠を記載した。
- `/plan` と commit 不要の文脈に合わせ、PR / commit は作成していない。
- 回答生成周辺では、前回 todo 寄りに扱った `Typed claim / value mismatch / riskSignals` を confirmed 実装済みに更新した。

## 検証

- `wc -l .workspace/rag-assist_仕様追加_統合版_実装ベース未記載追補.md`
  - 293 行で作成済み。
- `rg -n "^### 3\\.|状態:|^## 5|^## 6" .workspace/rag-assist_仕様追加_統合版_実装ベース未記載追補.md`
  - 13 件の追補項目と反映優先度、全量性メモを確認。
- `scripts/validate_spec_recovery.py`
  - スクリプトは存在するが、今回は `docs/spec-recovery/` ではなく `.workspace/` への追補作成のため未実行。

## 未対応・制約・リスク

- 生成物や CDK build output は調査対象から除外した。
- store / adapter の内部実装差分、全 UI component の細部 state は仕様項目としては深追いしていない。
- 既存の untracked report/task は保持し、commit は作成していない。
