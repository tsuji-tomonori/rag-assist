# PR #183 競合解消

状態: do

## 背景

PR #183 `codex/requirements-from-implementation-reports` が `main` に対して `DIRTY` になり、merge conflict が発生している。

## 目的

`origin/main` の最新変更を PR branch に取り込み、要求文書追加 PR の競合を解消して CI が再実行できる状態にする。

## スコープ

- `origin/main` の merge。
- 要求文書、索引、coverage map、task / report の競合解消。
- 必要な docs / API test の再実行。
- PR コメントとセルフレビューコメントの追加。

## 計画

1. `origin/main` を取得する。
2. PR branch に `origin/main` を merge する。
3. 競合ファイルを確認し、main 側の更新と PR 側の要件追加を両立させる。
4. 変更範囲に応じた検証を実行する。
5. 作業レポートを作成する。
6. commit / push / PR コメント / セルフレビューコメントまで行う。

## ドキュメント保守方針

要求文書の競合があれば、1 要件 1 ファイル、機能要求索引、`REQUIREMENTS.md`、`REQ_CHANGE_001.md` の整合を優先して解消する。実装挙動を追加変更しない場合、README / API examples / OPERATIONS は原則更新しない。

## 受け入れ条件

- [ ] PR #183 branch に `origin/main` が取り込まれている。
- [ ] 競合ファイルがすべて解消され、未解決 conflict marker が残っていない。
- [ ] 新規要件 ID と索引、トレーサビリティ、coverage map が整合している。
- [ ] 必要な検証が実行され、未実施検証は理由が記録されている。
- [ ] 作業レポートを `reports/working/` に残している。
- [ ] PR に競合解消結果とセルフレビューを日本語コメントで投稿している。

## 検証計画

- `git diff --check`
- `rg -n '<<<<<<<|=======|>>>>>>>'`
- 要件 ID の `rg` 整合確認
- `npm --prefix memorag-bedrock-mvp exec -w @memorag-mvp/api -- tsx --test src/rag/requirements-coverage.test.ts`
- 変更範囲次第で API coverage 全体または pre-commit を追加実行する。

## リスク

- `main` 側で同じ要件番号が追加されている場合、採番調整が必要になる。
- requirement coverage map と docs 索引のどちらかだけを更新すると CI が再度失敗する。
