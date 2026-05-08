# git-secrets pre-commit 設定

状態: do

## 背景

ユーザーから、`CornellNoteWeb` の `tools/git-secrets/git-secrets` と `.pre-commit-config.yaml` を参考に、このリポジトリへ `git-secrets` を設定する依頼があった。

## 目的

コミット前の pre-commit 実行で、AWS key などの secret らしき値を検出できるようにする。

## スコープ

- `tools/git-secrets/git-secrets` の追加
- `.pre-commit-config.yaml` への local `git-secrets` hook 追加
- 必要な pre-commit hook の差分調整
- 作業レポート、commit、PR、PR コメント

## 計画

1. 参照元の構成を確認する。
2. このリポジトリに合わせて `git-secrets` と pre-commit 設定を追加する。
3. 変更ファイルに対して `git diff --check` と pre-commit 検証を実行する。
4. 作業レポートを残し、commit/push/PR/comment まで進める。

## ドキュメント保守計画

開発者向け workflow 変更は `.pre-commit-config.yaml` と `Taskfile.yaml` の既存 `precommit` task で完結するため、README 追記が必要か確認する。追加手順が不要なら作業レポートで理由を記録する。

## 受け入れ条件

- [ ] `tools/git-secrets/git-secrets` が配置され、実行可能である。
- [ ] `.pre-commit-config.yaml` に local `git-secrets` hook が追加され、参照元相当の secret scan が pre-commit で実行される。
- [ ] 変更範囲に対して選定した検証を実行し、結果または未実施理由を記録する。
- [ ] 作業レポートを `reports/working/` に保存する。
- [ ] PR 作成後、受け入れ条件確認コメントとセルフレビューコメントを日本語で投稿する。

## 検証計画

- `git diff --check`
- `pre-commit run --files .pre-commit-config.yaml tools/git-secrets/git-secrets tools/git-secrets/pre-commit-scan tasks/do/20260509-0054-configure-git-secrets.md`
- `tools/git-secrets/pre-commit-scan .pre-commit-config.yaml`

## PR レビュー観点

- local hook の entry が実在パスを参照していること。
- secret scan が既存 hook と衝突せず、実施していない検証を PR 本文・コメントで実施済みにしないこと。
- RAG の根拠性・認可境界に影響しないこと。

## リスク

- pre-commit 実行時に既存ファイル内の false positive が出る可能性がある。
- `pre-commit-scan` は clone 直後でも検出できるよう、AWS 検出 pattern を Git 環境 config として scan 実行時だけ注入する。
