# PR213 チャット実行メタ情報配置変更の競合解消

状態: done

## 背景

PR #213 `codex/chat-run-meta-layout` が `main` に対して `DIRTY` 状態となり、競合解消が必要になった。

## 目的

`origin/main` の最新変更を取り込み、PR #213 のチャット実行メタ情報配置変更を維持したまま競合を解消する。

## スコープ

- PR #213 ブランチの merge conflict 解消
- 競合したファイルの整合性確認
- 必要な生成 docs 更新
- 変更範囲に応じた検証、commit、push、PR コメント更新

## 計画

1. `origin/main` を取り込み、競合箇所を確認する。
2. チャット UI の要求を維持しつつ、main 側の変更を失わないように解消する。
3. 必要な Web UI インベントリ生成物を再生成する。
4. web の型チェック、テスト、docs check、lint/build などを実行する。
5. 作業レポート、commit、push、PR コメント、task 完了更新を行う。

## ドキュメント保守方針

生成済み Web UI インベントリに差分が出る場合は `npm run docs:web-inventory` で更新する。恒久 docs の追加更新が不要な場合は作業レポートに理由を記録する。

## 受け入れ条件

- PR #213 の競合が解消されている。
- 画面上部からモデル選択、ドキュメント、実行ID、総レイテンシが消えた状態が維持されている。
- 添付ボタン横のモデル選択と下部実行IDコピーが維持されている。
- `origin/main` 側の変更を意図せず失っていない。
- 変更範囲に応じた検証を実行し、未実施の検証は理由を記録する。
- 作業レポートを `reports/working/` に作成する。

## 検証計画

- `git diff --check`
- `npm --prefix memorag-bedrock-mvp run typecheck -w @memorag-mvp/web`
- `npm --prefix memorag-bedrock-mvp run test -w @memorag-mvp/web`
- `npm --prefix memorag-bedrock-mvp run docs:web-inventory:check`
- 必要に応じて `npm --prefix memorag-bedrock-mvp run lint` と `npm --prefix memorag-bedrock-mvp run build -w @memorag-mvp/web`

## PR セルフレビュー観点

- main 側の変更を落としていないこと。
- UI 表示値が fake fallback になっていないこと。
- RAG の根拠性、認可境界、benchmark 固有値の実装混入がないこと。

## リスク

- main 側の同一 UI 周辺変更と重なっている場合、見た目やテスト期待値の再調整が必要になる。

## 完了結果

- PR: https://github.com/tsuji-tomonori/rag-assist/pull/213
- 競合解消 commit: `dab761c`
- 受け入れ条件確認コメント: 投稿済み。
- セルフレビューコメント: 投稿済み。
- 作業レポート: `reports/working/20260509-1031-resolve-chat-run-meta-conflicts.md`

## 検証結果

- `npm run docs:web-inventory`: pass
- `npm --prefix memorag-bedrock-mvp run ci`: pass
- `npm --prefix memorag-bedrock-mvp run docs:web-inventory:check`: pass
- `git diff --check`: pass

## 制約

- GitHub Checks は競合解消 commit push 直後の確認時点で queued。ローカルでは CI 相当チェックが pass。
