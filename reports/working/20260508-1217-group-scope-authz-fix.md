# 作業完了レポート: group-scope-authz-fix

- 指示: Aardvark 脆弱性の現存確認と、現存時の最小修正・検証・commit/PR 作成。
- 要件整理: group scope 文書は owner/admin/対象グループ以外を deny。scopeType=group で groupIds 空は拒否。
- 実施: `document-routes.ts` に group scope の入力検証を追加。`memorag-service.ts` / `hybrid-search.ts` / `retrieve-memory.ts` の `canAccessManifest` で `scopeType=group` の非メンバーを明示 deny。`memorag-service.test.ts` / `hybrid-search.test.ts` に legacy ACL を持たない group scope 文書の非メンバー遮断テストを追加。
- 検証: `pnpm -C memorag-bedrock-mvp/apps/api typecheck` 成功。追加対応で `npm --prefix memorag-bedrock-mvp run test -w @memorag-mvp/api`、`npm --prefix memorag-bedrock-mvp run typecheck -w @memorag-mvp/api`、`npm --prefix memorag-bedrock-mvp run test:coverage -w @memorag-mvp/api` 成功。
- 成果物: 上記4ファイル修正、API regression test、task md 更新。
- fit評価: 指示どおり最小修正で既存 ACL 判定を非 group scope に維持。
- 未対応/リスク: 実クラウド環境でのデータ確認は未実施。ローカル API test と coverage で regression は確認済み。
