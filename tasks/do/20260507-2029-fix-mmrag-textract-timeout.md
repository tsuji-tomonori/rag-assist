# MMRAG DocQA Textract タイムアウト修正

状態: do

## 背景

CodeBuild の `mmrag-docqa-v1` ベンチマーク実行で、PDF corpus seed 中に `NUS-FASS-Graduate-Guidebook-2021-small.pdf` の OCR fallback が `Textract job did not finish within 45000ms` により HTTP 500 で失敗した。

## 目的

MMRAG DocQA の大きめの PDF corpus seed が、Textract OCR fallback の固定 45 秒待機により失敗しにくいように修正する。

## スコープ

- 障害レポートを `reports/bugs/` に作成する。
- Textract OCR fallback の待機/設定/呼び出し経路を調査し、必要な修正を実装する。
- 変更範囲に対して最小十分な検証を実行する。
- 作業完了レポートを `reports/working/` に作成する。

## 非スコープ

- ベンチマーク評価ロジックの品質改善。
- MMRAG DocQA dataset 全体の採点改善。
- AWS 環境での本番 CodeBuild 再実行。ただしローカルで実行可能な検証は行う。

## 実施計画

1. CodeBuild ログから障害レポートを作成する。
2. OCR fallback のタイムアウト値と設定経路を特定する。
3. CodeBuild/benchmark 用に必要十分な待機時間を設定可能にする。
4. 対象テスト、型チェック、差分チェックを実行する。
5. レポート、commit、push、PR 作成、PR コメントまで進める。

## ドキュメント保守計画

挙動変更が環境変数や運用設定に関係する場合は、該当する README/docs/buildspec 付近の説明更新要否を確認する。不要な場合は理由を作業レポートに記録する。

## 受け入れ条件

- [ ] CodeBuild 障害の概要、影響、原因仮説、是正策を含む障害レポートが `reports/bugs/` に作成されている。
- [ ] Textract OCR fallback の 45 秒固定待機が、MMRAG DocQA の corpus seed で過度に早く失敗する原因に対して修正されている。
- [ ] 変更範囲に対応するテストまたは型チェックが実行され、結果が記録されている。
- [ ] 実施していない検証がある場合は、未実施理由がレポートと最終回答に明記されている。
- [ ] 作業完了レポートが `reports/working/` に作成されている。

## 検証計画

- `git diff --check`
- 変更対象 workspace の targeted test/typecheck
- 必要に応じて benchmark 関連のテストまたは dry-run 可能なスクリプト

## PR セルフレビュー観点

- docs と実装の同期が崩れていないこと。
- 変更範囲に見合うテストを実行していること。
- RAG の根拠性・認可境界を弱めていないこと。
- benchmark 期待語句、QA sample 固有値、dataset 固有分岐を実装に入れていないこと。

## リスク

- ローカル環境では AWS Textract 実ジョブの完了時間を完全再現できない可能性がある。
- タイムアウト延長は CodeBuild 全体時間を増やす可能性があるため、対象を benchmark runner に限定する必要がある。
