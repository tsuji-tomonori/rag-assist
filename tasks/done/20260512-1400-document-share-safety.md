# ドキュメント共有設定の事故防止

状態: done

## 背景

直近のドキュメント管理 UI/UX レビューで、共有設定フォームが既存 shared groups を初期入力へ反映しないため、空入力のまま共有更新すると既存共有を意図せず解除し得ると指摘された。

## 目的

ドキュメント管理画面のフォルダ共有設定で、既存共有を見える状態にし、未変更 submit と全解除の誤操作を防ぐ。

## タスク種別

修正

## なぜなぜ分析サマリ

- 問題文: 共有済みフォルダを選択した利用者が入力欄を変更していない状態で「共有更新」を押すと、既存 shared groups を解除する payload が送信され得る。
- confirmed: `DocumentWorkspace` は `shareGroups` を空文字で初期化し、`parseSharedGroups(shareGroups)` の結果を submit payload に使っている。
- confirmed: `DocumentDetailPanel` の既存候補 checkbox は `shareGroups.split(",")` だけを checked 判定に使っている。
- inferred: 既存共有状態と編集 draft が分離されておらず、対象フォルダ選択時の hydrate と dirty 判定がないため、UI が「未編集」と「全削除」を区別できない。
- open_question: backend API が空配列を private 化として扱う挙動はレビュー指摘ベースであり、このタスクでは UI 側の事故防止を優先する。
- root cause: 共有フォームの draft 初期化が対象フォルダの永続状態に同期されず、送信可否も validation error だけを見ていた。
- remediation: 対象フォルダ変更時に既存 `sharedGroups` を draft へ hydrate し、差分がない場合は submit を disabled にし、既存共有をすべて削除する場合は専用確認チェックを要求する。

## 作業範囲

- `memorag-bedrock-mvp/apps/web/src/features/documents/components/DocumentWorkspace.tsx`
- `memorag-bedrock-mvp/apps/web/src/features/documents/components/workspace/DocumentDetailPanel.tsx`
- `memorag-bedrock-mvp/apps/web/src/styles/features/documents.css`
- `memorag-bedrock-mvp/apps/web/src/features/documents/components/DocumentWorkspace.test.tsx`
- 作業レポート

## 実装計画

- 共有対象フォルダ確定時に `shareGroups` を `shareTargetGroup.sharedGroups.join(", ")` で hydrate する。
- shared groups の現在値と draft を比較し、dirty 判定を追加する。
- dirty でない場合は「共有更新」を disabled にする。
- 既存 shared groups があり、draft が空になる全解除時は専用確認 checkbox を表示し、未確認では submit できないようにする。
- checkbox checked 判定を parse 済み draft に基づける。

## ドキュメントメンテナンス計画

ユーザー可視 UI の誤操作防止修正だが、API 契約・運用手順・永続仕様は変更しない。恒久 docs 更新は不要と判断し、判断理由は作業レポートと PR 本文に記録する。

## 受け入れ条件

- [x] 共有対象フォルダを選択すると既存 `sharedGroups` が入力欄と候補 checkbox に反映される。
- [x] 共有内容が未変更の状態では「共有更新」が disabled になり、API が呼ばれない。
- [x] 既存共有をすべて解除する場合は専用確認が必要で、確認前は API が呼ばれない。
- [x] 全解除を確認した場合のみ `visibility: "private"` と空 `sharedGroups` を送信できる。
- [x] 共有候補は実データ由来のままで、架空候補を追加しない。
- [x] 変更範囲に見合う web test / typecheck / diff check を実行し、未実施検証は理由を残す。

## 検証計画

- `npm --prefix memorag-bedrock-mvp run test -w @memorag-mvp/web -- DocumentWorkspace`
- `npm --prefix memorag-bedrock-mvp run typecheck -w @memorag-mvp/web`
- `git diff --check`

## PR レビュー観点

- 既存共有を誤って消す経路が残っていないこと。
- 全解除は明示確認を経た場合だけ可能であること。
- 本番 UI に fake group / demo fallback を追加していないこと。
- 未実施検証を実施済みとして書かないこと。

## リスク

- 実ブラウザ操作と AWS 実環境操作は今回の範囲外。必要に応じて後続 PR で Playwright / 実環境 smoke を追加する。
