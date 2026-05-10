# ドキュメント管理 UX PR の競合解消

## 受けた指示

- `codex/document-management-ux-p0` の PR 競合を解消する。

## 要件整理

- `origin/main` を取り込み、未解決 conflict を残さない。
- 既存のドキュメント管理 UX 改善を維持する。
- 生成ドキュメントは手編集ではなく、現在の統合済みコードから再生成して整合させる。
- 解消後に必要な検証を実行し、未実施項目を実施済みとして扱わない。

## 実施作業

- `origin/main` を fetch し、作業ブランチへ merge した。
- `memorag-bedrock-mvp/docs/generated/web-accessibility.md`、`web-features.md`、`web-overview.md` の conflict を確認した。
- `npm --prefix memorag-bedrock-mvp run docs:web-inventory` で web inventory 生成物を再生成し、conflict marker を除去した。
- 解消済みファイルを stage した。

## 検証

- `npm --prefix memorag-bedrock-mvp run docs:web-inventory:check`
- `npm --prefix memorag-bedrock-mvp run test -w @memorag-mvp/web -- App DocumentWorkspace useDocuments`
- `npm --prefix memorag-bedrock-mvp run typecheck -w @memorag-mvp/web`
- `git diff --check`

## Fit 評価

- PR 上の merge conflict は、生成 docs を現行コードから再生成する形で解消した。
- ドキュメント管理 UX 改善の対象テストと web typecheck は通過している。

## 未対応・制約・リスク

- main 側で追加された infra / benchmark / debug / chat 変更については、競合解消の対象外として個別検証していない。
- 生成 docs の競合解消に限定し、機能仕様の追加変更は行っていない。
