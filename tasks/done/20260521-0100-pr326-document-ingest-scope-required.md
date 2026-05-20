# PR326 document ingest scope required

- 状態: done
- タスク種別: 修正
- 対象 PR: https://github.com/tsuji-tomonori/rag-assist/pull/326

## 背景

PR #326 の再レビューで、通常文書 upload / ingest の API 経路が `scope` 未指定を許し、フォルダ full 権限確認を通らない可能性が指摘された。Web UI は uploadGroupId と full 権限を要求しているが、API 直叩きや将来の別 UI 経路では no-scope document ingest が成立し得る。

## 目的

通常文書 ingest / upload API では group scope を必須化し、groupIds 空配列や scope 未指定を拒否する。あわせて manifest 閲覧・管理判定の no-scope fail-open と Web hook の空 uploadGroupId 経路を塞ぐ。

## なぜなぜ分析サマリ

- confirmed: `scopedMetadata` は `scope` 未指定時に metadata をそのまま返し、`assertDocumentGroupsWritable` を呼ばない。
- confirmed: `/documents/uploads/{uploadId}/ingest` と `/document-ingest-runs` は `authorizeScopedIngest` 後に `scopedMetadata` を使い、通常文書登録へ進む。
- confirmed: manifest の認可 helper は groupIds / owner / ACL がない metadata を最後に true として扱う経路がある。
- inferred: 既存の後方互換・小規模同期登録 API と、フォルダ必須の通常文書 ingest 方針が混在し、no-scope document の扱いが明示されていなかった。
- root cause: `purpose=document` の scope contract が API route / service helper / tests で一貫して必須化されていなかった。
- remediation: `purpose=document` の upload / ingest / POST /documents では group scope と非空 groupIds を必須にし、対象 group の writable assertion を必ず通す。no-scope manifest は一般ユーザーに可視化・管理可能としない。Web hook でも uploadGroupId 空なら upload API を呼ばない。
- open_question: `personal` scope を正式に許可する設計は本タスクでは導入しない。今回は通常文書の group scope 必須化を優先する。

## スコープ

- `apps/api/src/routes/document-routes.ts` の通常文書 scope validation。
- `apps/api/src/rag/memorag-service.ts` の manifest access/manage no-scope fail-closed。
- 必要に応じて `apps/api/src/search/hybrid-search.ts` / chat retrieval helper の同等 no-scope access 判定。
- API contract / route / service tests の追加・更新。
- `apps/web/src/features/documents/hooks/useDocuments.ts` と hook test の空 uploadGroupId guard。
- OpenAPI / generated docs 更新の要否確認。

## ドキュメント保守方針

API の挙動が変わるため OpenAPI docs と generated docs check の差分を確認し、必要なら再生成する。恒久仕様 docs は既存の「アップロード先フォルダ full 必須」と整合するため、今回の修正自体では原則追加しない。

## 受け入れ条件

- [x] `purpose=document` の `POST /documents` は group scope 未指定と groupIds 空配列を拒否する。
- [x] `POST /documents/uploads/{uploadId}/ingest` は group scope 未指定と groupIds 空配列を拒否する。
- [x] `POST /document-ingest-runs` は group scope 未指定と groupIds 空配列を拒否する。
- [x] 通常文書 ingest は対象 groupIds に対して `assertDocumentGroupsWritable` を必ず呼ぶ。
- [x] readOnly / nonexistent groupId は 403、full groupId は成功することをテストで固定する。
- [x] groupIds / owner / ACL がない通常文書 manifest は一般ユーザーに可視化されない。
- [x] Web hook は `uploadGroupId` 空のとき `uploadDocumentFile` を呼ばず、`ok:false` を返す。
- [x] 関連 API/Web テスト、typecheck、docs check、diff check が pass する。
- [x] PR に受け入れ条件確認コメントとセルフレビューコメントを日本語で追加する。

## 完了結果

- 実装修正 commit: `f115d0e108ae9ee02b00c73b12f118e583c7385d`
- 受け入れ条件確認コメント: https://github.com/tsuji-tomonori/rag-assist/pull/326#issuecomment-4500393957
- セルフレビューコメント: https://github.com/tsuji-tomonori/rag-assist/pull/326#issuecomment-4500396345
- 作業レポート: `reports/working/20260521-0115-pr326-document-ingest-scope-required.md`

## 検証計画

- `npm run test -w @memorag-mvp/api -- document-routes memorag-service access-control-policy`
- `npm run typecheck -w @memorag-mvp/api`
- `npm run test -w @memorag-mvp/web -- useDocuments`
- `npm run typecheck -w @memorag-mvp/web`
- `npm run docs:openapi:check`
- `npm run docs:web-inventory:check`
- `git diff --check`

## PR レビュー観点

- docs と実装の同期。
- 変更範囲に見合うテスト。
- RAG の根拠性・認可境界を弱めていないこと。
- benchmark 期待語句・QA sample 固有値・dataset 固有分岐を実装へ入れていないこと。

## リスク

- 既存 contract test が no-scope upload を前提にしている場合、group scope 付きに更新が必要。
- 後方互換の `POST /documents` も scope 必須化するため、明示 scope なしのクライアントは 400 になる。
