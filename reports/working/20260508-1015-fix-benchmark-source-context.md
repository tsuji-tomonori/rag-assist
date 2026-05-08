# 作業完了レポート: benchmark source context の fail-closed 復元

## 指示
- Aardvark 検出の脆弱性が HEAD に残っているか確認し、残っていれば最小修正で対処する。

## 要件整理と判断
- 脆弱性は「mutable な GitHub main を暗黙既定値として CodeBuild 実行すること」に起因。
- 最小修正として、CDK context の benchmark source を必須化し fail-closed に戻した。
- さらに deploy workflow の固定 main 指定を廃止し、実行コミット SHA を渡して mutable branch 依存を排除した。

## 実施内容
- `memorag-mvp-stack.ts` の benchmark source 既定値を削除。
- benchmark source context を required に変更し、未指定・空文字で例外化。
- `memorag-deploy.yml` の `benchmarkSource*` context を `github.repository_*` と `github.sha` へ変更。
- infra test を新仕様に合わせ、context 未指定時の throw を検証。
- snapshot を更新。

## 検証
- `npm --prefix memorag-bedrock-mvp run test -w @memorag-mvp/infra` は snapshot 差分で一度失敗。
- `UPDATE_SNAPSHOTS=1 npm --prefix memorag-bedrock-mvp run test -w @memorag-mvp/infra` で更新後、全件 pass。

## 成果物
- `.github/workflows/memorag-deploy.yml`
- `memorag-bedrock-mvp/infra/lib/memorag-mvp-stack.ts`
- `memorag-bedrock-mvp/infra/test/memorag-mvp-stack.test.ts`
- `memorag-bedrock-mvp/infra/test/__snapshots__/memorag-mvp-stack.snapshot.json`
- `reports/working/20260508-1015-fix-benchmark-source-context.md`

## fit 評価
- 総合fit: 4.8 / 5.0
- 理由: 脆弱な default/mutable branch 実行経路を最小差分で遮断し、関連テストで検証済み。実クラウドデプロイ検証は未実施。
