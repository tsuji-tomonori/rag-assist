# タスク: deploy workflow shell injection 修正

- 状態: doing

## 受けた指示
- Aardvark 指摘の脆弱性が現行 HEAD に存在するか確認し、存在する場合は最小修正で対処する。
- 既存機能・テストを維持する。

## 受け入れ条件
1. `.github/workflows/memorag-deploy.yml` で `run:` 内に `${{ inputs.* }}` を直接埋め込まない。
2. workflow_dispatch の入力値は shell で評価されない形（env 経由 + 厳格バリデーション）で CDK に渡される。
3. `git diff --check` が成功する。

## 検証計画
- 変更後に `git diff --check` を実行。
- 該当 workflow を目視確認し、`run` ブロック内 direct interpolation が無いことを確認。
