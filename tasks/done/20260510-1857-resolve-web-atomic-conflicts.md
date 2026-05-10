# PR #239 競合解消 2026-05-10 18:57

状態: done

## 背景

`codex/web-atomic-refactor` に最新の `origin/main` を取り込んだ際、ドキュメント管理画面と generated web inventory docs に競合が発生した。

## タスク種別

修正

## 目的

Atomic Design 寄りに分割済みの documents workspace 構成を維持しながら、`origin/main` 側で追加されたドキュメント最近の操作表示、所属フォルダ列、モバイル向け data-label を取り込む。

## 受け入れ条件

- [x] `DocumentWorkspace.tsx` の分割済み構成を維持する。
- [x] `origin/main` 側の最近の操作表示を `DocumentDetailPanel` に統合する。
- [x] 文書一覧に所属フォルダ表示と data-label を反映する。
- [x] generated web inventory docs を再生成し、競合 marker を残さない。
- [x] web の typecheck、lint、test、build、inventory check が通る。
- [x] `git diff --check` と conflict marker 検索が通る。

## 実施内容

- `DocumentWorkspace` にセッション内操作イベントの記録と `buildOperationEvents` 呼び出しを統合した。
- `DocumentDetailPanel` の「最近の更新」を「最近の操作」に置き換えた。
- `DocumentFilePanel` に所属フォルダ列、セル `data-label`、操作ボタン wrapper を追加した。
- `documentWorkspaceUtils` に operation event helper と group name helper を追加した。
- `npm --prefix memorag-bedrock-mvp run docs:web-inventory` で generated docs を再生成した。

## 検証

- `npm --prefix memorag-bedrock-mvp run typecheck -w @memorag-mvp/web`: pass
- `npm --prefix memorag-bedrock-mvp run lint`: pass
- `npm --prefix memorag-bedrock-mvp run test -w @memorag-mvp/web`: pass
- `npm --prefix memorag-bedrock-mvp run build -w @memorag-mvp/web`: pass
- `npm --prefix memorag-bedrock-mvp run docs:web-inventory:check`: pass
- `git diff --check`: pass
- `rg -n "^(<<<<<<<|=======|>>>>>>>)" memorag-bedrock-mvp tasks --glob '!reports/**'`: pass

## リスク

- merge により API / infra / benchmark 側を含む `origin/main` の変更が取り込まれているが、今回手で解消した範囲は documents web UI と generated web inventory docs に限定した。
