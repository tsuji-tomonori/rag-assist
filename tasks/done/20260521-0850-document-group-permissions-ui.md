# Document group permissions UI fix

状態: done

## 背景

画面右上の `+` がフォルダ作成ボタンに見える一方、現行 UI ではアップロードショートカットとして実装されている。保存先未選択時に disabled になる理由が分かりにくく、さらに Web 側がフォルダ作成可否にも `rag:doc:write:group` 相当の `canWrite` を使っており、API の `POST /document-groups` が要求する `rag:group:create` とズレる。

## 目的

アップロード導線とフォルダ作成導線を明確に分け、フォルダ作成・共有更新・アップロードの UI 権限判定を API permission に合わせる。

## タスク種別

修正

## なぜなぜ分析サマリ

- 問題文: 文書管理画面で、保存先未選択時の右上ショートカットが disabled になり、利用者がフォルダ作成ボタンを押せない状態と誤認しうる。また、フォルダ作成 UI の feature permission が API の要求権限と一致していない。
- 確認済み事実:
  - `DocumentWorkspace` の `canUploadToDestination` は `canWrite && Boolean(uploadGroupId) && Boolean(uploadDestination && canManageDocumentGroup(uploadDestination))`。
  - `DocumentWorkspace` の `canCreateGroup` と共有更新系の判定は `canWrite` を共用している。
  - `usePermissions` は `canWriteDocuments = rag:doc:write:group` を返し、`buildDocumentRouteProps` 相当の経路で `DocumentWorkspace` に `canWrite` として渡している。
  - API の `POST /document-groups` は `rag:group:create` を `requirePermission` している。
- 推定原因:
  - UI 側の書き込み権限が、文書アップロード・フォルダ作成・共有設定更新という別操作を 1 つの `canWrite` に集約している。
  - 右上ショートカットの視覚表現が `+` で、保存先未選択時の disabled 理由が見えにくい。
- 根本原因:
  - feature permission と resource-level permission の責務分離が UI props に反映されていない。
  - 主要操作の accessible name と disabled reason が、実際の操作内容に対して十分に明示されていない。
- 対策:
  - `canCreateGroup`, `canShareGroup`, `canUpload` を `DocumentWorkspace` へ分離して渡す。
  - 作成可否は `rag:group:create` と親フォルダ full 権限、入力 validation で判定する。
  - アップロードボタンの名前・説明を「ファイルをアップロード」に統一し、保存先未選択理由を表示する。
  - API route test で `rag:group:create`、親フォルダ full、canonical path 重複の制約を固定する。
- 未確認点:
  - 既存 UI レイアウトで追加の「フォルダを作成」導線をどこに置くのが最小変更かは、実装前にコンポーネント構造を確認して判断する。

## スコープ

- Web: `usePermissions`、app shell route props、`DocumentWorkspace` と関連 panel、単体テスト。
- API: `POST /document-groups` の権限・親権限・重複制約の route test 追加または更新。
- Docs: durable docs の更新要否を確認し、今回の挙動変更が既存 docs に明記されていない場合は作業レポートで理由を残す。

## 実装計画

1. 既存 `DocumentWorkspace` とテスト helper の構造を確認する。
2. `usePermissions` に `canCreateDocumentGroups` と `canShareDocumentGroups` を追加し、`canManageDocuments` を管理操作の OR に更新する。
3. `DocumentWorkspace` の props を `canCreateGroup`, `canShareGroup`, `canUpload` に分離する。
4. 右上アップロードショートカットの accessible name と disabled reason を明示する。
5. フォルダ作成導線を上部またはフォルダツリー付近に追加し、作成フォームへ focus する。
6. Web 単体テストと API route test を追加・更新する。
7. 関連テスト、typecheck、`git diff --check` を実行する。

## ドキュメント保守計画

- README、`docs/`、API 例で文書管理権限 UI を説明している箇所を `rg` で確認する。
- API 契約自体は既存 permission を維持するため、 durable docs への追加が不要な場合は作業レポートに理由を記載する。

## 受け入れ条件

- 右上ショートカットがフォルダ作成ではなく「ファイルをアップロード」として表示され、保存先未選択時に disabled になる。
- 保存先未選択時のアップロード disabled 理由が UI 上で確認できる。
- `rag:group:create` 相当の `canCreateGroup` があれば、`rag:doc:write:group` 相当の `canUpload` がなくてもフォルダ作成できる。
- `rag:doc:write:group` 相当の `canUpload` だけではフォルダ作成できない。
- 親フォルダが `readOnly` の場合は子フォルダ作成が disabled になり、管理権限が必要な理由を表示する。
- 親フォルダが `full` の場合は子フォルダ作成 payload に `parentGroupId` を含める。
- shared groups と管理者 ID の空値・重複 validation では作成 API を呼ばない。
- `POST /document-groups` は `rag:group:create` なしで 403 を返す。
- `POST /document-groups` は `parentGroupId` 配下に full 権限がない場合 403 を返す。
- `POST /document-groups` は同一管理者・同一 canonical path の重複を 400 にする。

## 検証計画

- `npm run test -w @memorag-mvp/web`
- `npm run typecheck -w @memorag-mvp/web`
- `npm run test -w @memorag-mvp/api`
- `npm run typecheck -w @memorag-mvp/api`
- `git diff --check`

## 検証結果

- `npm ci`: pass。worktree に依存関係がなく、初回 typecheck が `tsc: not found` で失敗したため実行。
- `npm run typecheck -w @memorag-mvp/web`: pass
- `npm run test -w @memorag-mvp/web`: 初回 fail -> テスト期待値修正後 pass
- `npm run typecheck -w @memorag-mvp/api`: pass
- `npm run test -w @memorag-mvp/api`: 初回既存 contract SSE test が fail -> 再実行 pass
- `git diff --check`: pass

## PR レビュー観点

- docs と実装の同期。
- 変更範囲に見合うテスト。
- RAG の根拠性・認可境界を弱めていないこと。
- benchmark 期待語句、QA sample 固有値、dataset 固有分岐を実装に入れていないこと。

## リスク

- `canWrite` props の分離により既存テストの setup が多く影響を受ける可能性がある。
- API route test の既存 helper 構造によって、受け入れ条件の一部は既存 service test と組み合わせて固定する判断が必要になる可能性がある。
