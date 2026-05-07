# 抽出不能 benchmark corpus PR の競合解消

状態: done

## 背景

PR #152 `codex/skip-unextractable-benchmark` が `main` との競合状態になったため、最新 `origin/main` を取り込んで競合を解消する。

## 目的

PR #152 を merge 可能な状態に戻し、抽出不能 corpus skip 対応の挙動を保ったまま最新 `main` と整合させる。

## 範囲

- `origin/main` の取り込み
- 競合ファイルの解消
- 必要な検証
- 作業レポート、commit、push、PR コメント

## 受け入れ条件

- `codex/skip-unextractable-benchmark` に最新 `origin/main` が取り込まれている。
- conflict marker が残っていない。
- 抽出不能 corpus skip 対応のテストが維持されている。
- 変更範囲に見合う検証を実行し、結果を記録する。
- PR #152 に競合解消内容と検証結果をコメントする。

## 検証計画

- `git diff --check`
- `npm --prefix memorag-bedrock-mvp run test -w @memorag-mvp/benchmark`
- `npm --prefix memorag-bedrock-mvp run typecheck -w @memorag-mvp/benchmark`

## リスク

- `main` 側の benchmark runner 変更と skip 対応が重なる場合、summary/report の型や出力仕様を手作業で統合する必要がある。
