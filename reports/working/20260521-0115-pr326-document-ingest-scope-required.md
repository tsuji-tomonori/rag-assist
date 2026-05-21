# PR #326 通常文書 ingest group scope 必須化 作業レポート

## 受けた指示
- PR #326 の再レビュー指摘として、通常文書アップロード/ingest の API 経路で scope 未指定が許可され得る問題を merge 前に修正する。
- `purpose=document` では group scope と対象フォルダ full 権限を API 側で必須にする。
- Web hook 側でも `uploadGroupId` 空の場合は通常文書アップロード API を呼ばない。
- no-scope / 空 `groupIds` / 存在しない group / full group 成功 / ACL なし manifest 非表示をテストで固定する。

## 要件整理
| 要件ID | 要件 | 対応状況 |
|---|---|---|
| R1 | `POST /documents` の通常文書で group scope 未指定・personal scope を拒否 | 対応 |
| R2 | `/documents/uploads/{uploadId}/ingest` の通常文書で group scope 未指定・空 `groupIds` を拒否 | 対応 |
| R3 | `/document-ingest-runs` の通常文書で group scope 未指定・空 `groupIds` を拒否 | 対応 |
| R4 | 対象 group の full 権限確認を API 経路で必ず通す | 対応 |
| R5 | ACL/group/owner がない通常 manifest を一般ユーザーへ fail-open しない | 対応 |
| R6 | Web hook は `uploadGroupId` 空で API を呼ばず `ok:false` を返す | 対応 |
| R7 | 関連テスト、型検査、OpenAPI docs check を通す | 対応 |

## 検討・判断
- `scopedMetadata` で `purpose=document` の場合だけ group scope を必須化し、`benchmarkSeed` と `chatAttachment` の既存スコープ規則は維持した。
- `/documents` は従来 purpose field を持たないため、benchmark seed metadata に一致する場合だけ `benchmarkSeed` と判定し、それ以外は通常文書として group scope を要求した。
- manifest 認可は ACL/group/owner がない場合に一般ユーザーへ visible / manageable としない fail-closed へ寄せた。検索系の helper も同じ判定に揃えた。
- 既存テスト fixture は、公開扱いにしたいものへ `aclGroups`、管理操作対象へ `ownerUserId` を明示し、暗黙の公開/管理を前提にしない形へ更新した。

## 実施作業
- `apps/api/src/routes/document-routes.ts` で通常文書の group scope 必須化と `assertDocumentGroupsWritable` 呼び出しを追加。
- `apps/api/src/rag/memorag-service.ts` と検索/チャット検索 helper で ACL/group/owner なし manifest を fail-closed 化。
- `apps/web/src/features/documents/hooks/useDocuments.ts` で `uploadGroupId` 空の通常文書アップロードを早期 return。
- API contract / service / Web hook テストへ拒否ケースと成功ケースを追加・更新。
- OpenAPI 説明文と生成済み Markdown を同期。

## 成果物
| 成果物 | 内容 |
|---|---|
| `apps/api/src/routes/document-routes.ts` | 通常文書 ingest の group scope 必須化 |
| `apps/api/src/rag/memorag-service.ts` | manifest 認可の ACL なし fail-closed 化 |
| `apps/api/src/search/hybrid-search.ts` | 検索 manifest 認可の ACL なし fail-closed 化 |
| `apps/api/src/chat-orchestration/nodes/search-evidence.ts` | evidence 検索 manifest 認可の ACL なし fail-closed 化 |
| `apps/api/src/chat-orchestration/nodes/retrieve-memory.ts` | memory retrieval manifest 認可の ACL なし fail-closed 化 |
| `apps/web/src/features/documents/hooks/useDocuments.ts` | 空 upload destination の API 呼び出し抑止 |
| `apps/api/src/contract/api-contract.test.ts` | no-scope / empty groupIds / missing group / full group 成功の回帰テスト |
| `apps/api/src/rag/memorag-service.test.ts` | ACL なし manifest 非表示と fixture 明示化 |
| `apps/web/src/features/documents/hooks/useDocuments.test.ts` | `uploadGroupId` 空で API を呼ばないテスト |
| `docs/generated/openapi/` | group scope 必須の説明文同期 |

## 検証
- `npm run test -w @memorag-mvp/web -- useDocuments.test.ts` 成功
- `../../node_modules/.bin/tsx --test src/rag/memorag-service.test.ts src/contract/api-contract.test.ts` 成功
- `npm run typecheck -w @memorag-mvp/api` 成功
- `npm run typecheck -w @memorag-mvp/web` 成功
- `npm run docs:openapi -w @memorag-mvp/api` 成功
- `npm run docs:openapi:check -w @memorag-mvp/api` 成功
- `npm run test -w @memorag-mvp/api` 成功

## Fit 評価
総合fit: 5.0 / 5.0

理由: レビュー指摘の scope 未指定通常文書 ingest 経路を API/Web 両面で fail-closed にし、no-scope、空 `groupIds`、存在しない group、full group 成功、ACL なし manifest 非表示をテストで固定した。関連する型検査、API 全体テスト、Web hook テスト、OpenAPI docs check も通過した。

## 未対応・制約・リスク
- CI のリモート実行結果はこの時点では未確認。ローカル検証は上記の範囲で完了。
- `tsx` の直接実行は sandbox の IPC pipe 制約で EPERM になったため、対象 API テストの一部は承認後に sandbox 外で実行した。
