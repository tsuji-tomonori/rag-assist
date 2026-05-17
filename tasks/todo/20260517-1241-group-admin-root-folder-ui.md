# group 管理者 root folder 作成 UI

状態: todo
タスク種別: 機能追加

## 背景

PR #321 後の API は `adminPrincipalType=group` と `adminPrincipalId` を受け、group 管理 namespace の root folder を作成できる。一方、Web の folder 作成 hook / UI は admin principal を選択できず、root 作成は実質 user 管理 namespace に寄っている。

## 目的

Web UI から group 管理者 namespace の root folder を作成できるようにし、user 管理 folder と group 管理 folder を canonical path と表示上で区別できるようにする。

## 対象範囲

- `apps/web/src/features/documents/hooks/useDocuments.ts`
- `apps/web/src/features/documents/api/documentsApi.ts`
- `apps/web/src/features/documents/components/workspace/DocumentWorkspace.tsx`
- group / role 候補取得 API の有無確認
- API / Web tests、Web inventory

## 含まない

- Cognito group 管理 UI 全体。
- group membership 管理。

## 昇華メタ情報

- 優先度: P2。API は対応済みだが、UI には group 候補 source の前提が必要。
- 依存関係: group / role directory API、admin principal validation、folder create UI。
- 推奨 PR 分割:
  - PR 1: Web hook / API client 型同期。
  - PR 2: group 候補取得 source の実装または既存 API 接続。
  - PR 3: create folder UI の admin principal selector。
- 成功指標: 権限のある user が実在 group namespace に root folder を作成できる。

## 実装設計メモ

- group 候補 API がない場合、先に候補取得 task を切る。架空候補は作らない。
- child folder は parent の admin principal を継承し、UI で変更させない。
- user namespace と group namespace は同一 canonical path でも別 namespace として表示する。
- permission error は group membership 不足か system admin 不足かを安全な範囲で表示する。

## 追加確認観点

- `adminPrincipalId` を client 入力だけで信用しない。
- group root 作成後の folder tree search / upload destination が namespace を混同しない。
- local auth / test fixture で group namespace を再現できる。

## 未確定点

- group 候補を Cognito group API、admin users API、または別 directory から取るか。

## 実行計画

1. API client と Web hook の create group input 差分を確認する。
2. UI で admin principal を選ぶための実データ source を確認する。
3. 実データ source がない場合、架空候補を出さず、利用可能な範囲で user root のままにするか API 追加 task へ分離する。
4. group 管理 folder を作成できる UI と validation を追加する。
5. folder tree で user / group namespace の識別表示を検討する。
6. 権限不足時の API error 表示を追加する。

## ドキュメント保守計画

- Web inventory を更新する。
- 新しい group 候補 API を追加する場合は OpenAPI docs を更新する。
- 実データ source が未整備の場合は、PR 本文で未対応範囲を明記する。

## 受け入れ条件

- Web hook の create group input が API schema の `adminPrincipalType` / `adminPrincipalId` と同期する。
- 権限のある利用者は group 管理 root folder を作成できる。
- 権限のない利用者は group 管理 root folder を作成できない。
- folder tree または詳細表示で user 管理 namespace と group 管理 namespace を識別できる。
- 本番 UI に架空 group 候補を表示しない。
- child folder 作成時は parent の admin principal を継承する。

## 検証計画

- `npm run test -w @memorag-mvp/web -- DocumentWorkspace useDocuments`
- `npm run test -w @memorag-mvp/api -- document-group`
- `npm run typecheck --workspaces --if-present`
- `npm run docs:web-inventory:check`
- `git diff --check`

## PR レビュー観点

- UI が存在しない group を選択肢として生成していないこと。
- API の group membership / system admin validation と UI 表示が矛盾しないこと。
- user namespace と group namespace の path 重複を誤って同一扱いしていないこと。

## リスク

- group 候補 API がない場合、先に group directory / membership lookup の task が必要になる可能性がある。
