# PR327 競合解消

状態: done

## 背景

PR 327 が `mergeStateStatus: DIRTY` となっており、`main` との差分で競合解消が必要になった。

## 目的

PR 327 の branch `codex/folder-permission-ac-suite` に最新 `origin/main` を取り込み、競合を解消して再度 merge 可能な状態に近づける。

## タスク種別

修正

## なぜなぜ分析サマリ

- 問題文: PR 327 が GitHub 上で `DIRTY` となり、main へそのまま merge できない。
- 確認済み事実:
  - ローカル branch は clean。
  - `gh pr view 327` で `mergeStateStatus: DIRTY`。
  - 競合ファイルはまだローカル merge 前のため未確定。
- 推定原因:
  - PR 作成後に `main` 側で同一または近接ファイルに変更が入り、PR branch の差分と競合している。
- 根本原因:
  - 長く開いている PR branch と進行中の main 更新の間で、同じ検索・テスト・task/report 領域の編集が並行した。
- 対策:
  - `origin/main` を取得して PR branch に merge し、競合ファイルを確認して、PR 327 の意図と main の変更を両立する形で解消する。

## 作業範囲

- PR 327 branch の競合解消
- 必要な対象テストと差分チェック
- 作業レポート、commit、push、PR コメント

## 受け入れ条件

- `origin/main` の取り込みで発生した競合が解消されている。
- PR 327 の folder permission search 変更と `folderId/folderIds` 回帰テストが残っている。
- 関連する API テストまたは最小十分な検証が pass している。
- `git status` が clean で、branch が origin に push 済み。
- PR に競合解消と検証結果のコメントを残している。

## 検証計画

- 競合解消後に変更範囲を確認する。
- `npm run test -w @memorag-mvp/api -- --test-name-pattern "folder-scoped search|semantic-only search includes folderId|folder policy documents|document group|search"`
- `npm run typecheck -w @memorag-mvp/api`
- `git diff --check`

## ドキュメント保守方針

競合解消が実装挙動を追加変更しない場合、README / docs 更新は不要。必要があれば作業レポートに判断を記録する。
