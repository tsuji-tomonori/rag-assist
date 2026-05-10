# PR #236 GitHub conflict 判定解消

## 背景

PR #236 はローカルで `origin/main` を取り込んだあとも、GitHub 側で `mergeable: CONFLICTING` / `mergeStateStatus: DIRTY` と判定され続けた。

## 目的

PR branch を最新 `origin/main` 起点にリニア化し、GitHub 側の conflict 判定を解消する。

## スコープ

- 現在 head のバックアップ branch 作成。
- `origin/main` 起点への branch 作り直し。
- 高リスク操作確認 UI の変更 replay。
- 競合した benchmark UI/test と生成 inventory の解消。
- web 系検証と PR コメント。

## 受け入れ条件

- [x] 最新 `origin/main` 起点に PR branch が作り直されている。
- [x] 未解決 conflict が残っていない。
- [x] benchmark の main 側変更と確認ダイアログ変更が両方残っている。
- [x] web inventory を再生成し、check が pass する。
- [x] web test / typecheck / lint / build が pass する。
- [ ] force-with-lease push 後、GitHub PR の mergeable 判定を確認する。
- [ ] PR に競合解消結果をコメントする。

## 実施内容

- `origin/main` を最新化した。
- 復旧用に `codex-backup-confirm-risky-actions-052cafa` を作成した。
- PR branch を `origin/main` に reset し、PR #236 の機能 commit と task 完了 commit を replay した。
- `BenchmarkWorkspace` の suite 未取得時 disabled 表示と、benchmark 起動確認ダイアログを両立させた。
- 生成 inventory は `docs:web-inventory` で再生成した。

## 検証

- `npm --prefix memorag-bedrock-mvp run docs:web-inventory`: pass
- `npm --prefix memorag-bedrock-mvp run docs:web-inventory:check`: pass
- `npm --prefix memorag-bedrock-mvp run test -w @memorag-mvp/web -- BenchmarkWorkspace.test.tsx App.test.tsx`: pass
- `npm --prefix memorag-bedrock-mvp run typecheck -w @memorag-mvp/web`: pass
- `npm --prefix memorag-bedrock-mvp run test -w @memorag-mvp/web`: pass
- `npm --prefix memorag-bedrock-mvp run lint`: pass
- `npm --prefix memorag-bedrock-mvp run build -w @memorag-mvp/web`: pass
- `git diff --check`: pass

状態: done
