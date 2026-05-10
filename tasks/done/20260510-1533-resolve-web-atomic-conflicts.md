# PR #239 競合解消

状態: done

## 背景

`codex/web-atomic-refactor` に `origin/main` を取り込んだ際、web の管理画面・ドキュメント画面・生成済み web inventory docs に競合が発生した。

## タスク種別

修正

## 目的

Atomic Design 寄りに分割済みの構成を維持しながら、`origin/main` 側で追加された確認ダイアログとドキュメントフォルダ作成拡張を取り込む。

## 受け入れ条件

- [x] `AdminWorkspace.tsx` の巨大 inline 実装へ戻さず、分割済み panel に upstream の確認ダイアログを移植する。
- [x] `DocumentWorkspace.tsx` の分割済み構成を維持し、フォルダ作成時の説明、親フォルダ、公開範囲、共有 group、管理者 user ID、作成後移動を扱える。
- [x] generated web inventory docs を再生成し、競合 marker を残さない。
- [x] web の typecheck、lint、test、build、inventory check が通る。
- [x] `git diff --check` と conflict marker 検索が通る。

## 実施内容

- `AliasAdminPanel` に publish / disable の確認ダイアログを移植した。
- `AdminUserPanel` に suspend / delete の確認ダイアログを移植した。
- `DocumentWorkspace` と `DocumentDetailPanel` に拡張フォルダ作成入力と validation preview を統合した。
- `documentWorkspaceUtils` に `parseListInput` と `visibilityLabelValue` を追加した。
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

- merge により API 側を含む `origin/main` の多数の変更が取り込まれているが、今回手で解消した範囲は web UI の競合箇所に限定した。
