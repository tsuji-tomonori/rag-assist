# 作業完了レポート: group-scope-authz-fix

- 指示: Aardvark 脆弱性の現存確認と、現存時の最小修正・検証・commit/PR 作成。
- 要件整理: group scope 文書は owner/admin/対象グループ以外を deny。scopeType=group で groupIds 空は拒否。
- 実施: `document-routes.ts` に group scope の入力検証を追加。`memorag-service.ts` / `hybrid-search.ts` / `retrieve-memory.ts` の `canAccessManifest` で `scopeType=group` の非メンバーを明示 deny。
- 検証: `pnpm -C memorag-bedrock-mvp/apps/api typecheck` 成功。
- 成果物: 上記4ファイル修正、task md 更新。
- fit評価: 指示どおり最小修正で既存 ACL 判定を非 group scope に維持。
- 未対応/リスク: 追加ユニットテストは未実施（既存 typecheck のみ）。
