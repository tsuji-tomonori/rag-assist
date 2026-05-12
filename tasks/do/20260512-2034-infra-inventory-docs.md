# infra inventory docs

- 状態: do
- タスク種別: 機能追加
- 作成日時: 2026-05-12 20:34 JST

## 背景

Web は UI コンポーネント棚卸し、API は OpenAPI 仕様を Markdown として静的生成している。一方で infra は、CDK で作成される AWS リソース数や主要設定値を同じように静的生成する導線がない。

## 目的

CDK stack から生成された CloudFormation template を根拠に、AWS リソースの個数、logical id、主要設定値を Markdown/JSON として静的に書き出し、drift check できるようにする。

## スコープ

- `memorag-bedrock-mvp` の infra inventory 生成 script を追加する。
- `docs/generated/` 配下に infra inventory の Markdown/JSON を生成する。
- `npm scripts`、Taskfile、README、CI check 導線を更新する。
- 実リソースや AWS 環境は変更しない。

## 実施計画

1. 既存の web/API 生成導線と infra CDK snapshot を確認する。
2. CloudFormation template JSON を入力にした infra inventory generator を実装する。
3. 生成物を作成し、`--check` で最新性を検出できるようにする。
4. package script、Taskfile、README、CI を更新する。
5. 変更範囲に応じた検証を実行する。
6. 作業レポート、commit、push、PR、受け入れ条件コメント、task done 移動まで行う。

## ドキュメントメンテナンス計画

- `memorag-bedrock-mvp/README.md` に infra inventory の参照先と実行コマンドを追加する。
- 生成 docs は `memorag-bedrock-mvp/docs/generated/` 配下に置き、手編集禁止コメントを入れる。

## 受け入れ条件

- [ ] `npm run docs:infra-inventory` で infra resource inventory Markdown/JSON が生成される。
- [ ] `npm run docs:infra-inventory:check` で生成物の drift を検出できる。
- [ ] Markdown に CloudFormation Type 別個数と resource logical id 別の主要設定値が含まれる。
- [ ] npm scripts、Taskfile、README、CI の実行導線が既存 web/API 生成 docs と整合する。
- [ ] 変更範囲に応じた検証が実行され、未実施項目は理由付きで記録される。

## 検証計画

- `npm run docs:infra-inventory`
- `npm run docs:infra-inventory:check`
- `npm test -w @memorag-mvp/infra`
- `git diff --check`

## 実施結果

- `npm run docs:infra-inventory`: pass。`docs/generated/infra-inventory.md` と `docs/generated/infra-resource-inventory.json` を生成。
- `npm run docs:infra-inventory:check`: pass。
- `task docs:infra-inventory:check`: pass。Taskfile から npm script へ委譲されることを確認。
- `npm exec -- eslint tools/infra-inventory --max-warnings=0`: pass。依存関係未展開時の初回実行は registry 解決で失敗したため、`npm ci` 後に再実行。
- `npm test -w @memorag-mvp/infra`: pass。
- `git diff --check`: pass。

## PRレビュー観点

- 生成物の source of truth が CDK snapshot/template から外れていないこと。
- secret 実体や過剰に機微な値を生成物に出していないこと。
- infra 変更時に docs drift が CI で検出されること。

## リスク

- CloudFormation intrinsic function の全内容を人間向けに要約しきれない可能性があるため、主要設定値は安全な短縮表示にする。
- CDK snapshot が古い場合、生成 docs も古くなる。既存 infra test の snapshot 更新運用に従う。
