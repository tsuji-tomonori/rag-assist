# タスク: deploy workflow shell injection 修正

- 状態: done

## 受けた指示
- Aardvark 指摘の脆弱性が現行 HEAD に存在するか確認し、存在する場合は最小修正で対処する。
- 既存機能・テストを維持する。

## 受け入れ条件
1. [x] `.github/workflows/memorag-deploy.yml` で `run:` 内に `${{ inputs.* }}` を直接埋め込まない。
2. [x] workflow_dispatch の入力値は shell で評価されない形（env 経由 + 厳格バリデーション）で CDK に渡される。
3. [x] `git diff --check` が成功する。

## 検証結果
- `git diff --check`: pass。
- `rg "\$\{\{ inputs\.(default-model-id|embedding-model-id|embedding-dimensions)" .github/workflows/memorag-deploy.yml`: 該当なし。
- PR CI: MemoRAG CI は pass。semver ラベル検証は `semver:patch` ラベル追加で再検証対象。
