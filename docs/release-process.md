# セマンティックバージョンとリリース運用

## 目的

デプロイごとに `vMAJOR.MINOR.PATCH` を採番し、GitHub Releases で差分管理を自動化する。

## 運用ルール

1. `main` 向け PR には必ず次のいずれか 1 つを設定する。
   - `semver:major`
   - `semver:minor`
   - `semver:patch`
2. `main` マージ時に `Release Management` workflow が次バージョンを算出する。
3. 自動でタグ `vX.Y.Z` を作成し、GitHub Release を生成する。
4. リリースノートは GitHub の自動生成を利用し、必要に応じて追記する。

## 手動リリース

`Release Management` を `workflow_dispatch` で実行し、`bump` を指定する。

## 初回セットアップ

- リポジトリラベルを作成する。
  - `semver:major`
  - `semver:minor`
  - `semver:patch`
- Branch protection で `Release Management / validate-semver-label` を必須チェックに設定する。
