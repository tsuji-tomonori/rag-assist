# 作業完了レポート

保存先: `reports/working/20260520-2130-pr326-resource-permission-fix.md`

## 1. 受けた指示

- PR #326 の競合を解決する。
- review result の Request changes 相当指摘を修正する。
- `rag:group:create` と `rag:group:assign_manager` の境界を Web/API で塞ぐ。
- upload/share/edit を対象フォルダの resource-level `full` 実効権限で制御する。
- 単体テストと CI gate 相当の検証を追加・実行する。

## 2. 要件整理

| 要件ID | 指示・要件 | 重要度 | 対応状況 |
|---|---|---:|---|
| R1 | `origin/main` との conflict を解消する | 高 | 対応 |
| R2 | create only 権限で共有・管理者 payload を送らない | 高 | 対応 |
| R3 | API create payload の共有系指定に assign_manager 権限を要求する | 高 | 対応 |
| R4 | upload 候補と submit を `effectivePermission=full` に限定する | 高 | 対応 |
| R5 | share/edit submit を `canShareGroups && effectivePermission=full` に限定する | 高 | 対応 |
| R6 | 指摘を単体テストで固定する | 高 | 対応 |
| R7 | CI gate 相当を確認する | 中 | ローカルで主要 check を対応。GitHub Actions は push 後に確認 |

## 3. 検討・判断したこと

- `origin/main` 側に入っていた folder permission foundation と `effectivePermission` を採用し、PR #326 の modal / feature permission 分離と統合した。
- create form は共有設定の入力 UI を `canShareGroups` で disabled にし、submit payload と `useDocuments` hook の両方で共有系フィールドを除外した。
- upload は「dialog を開く権限」と「submit 可能な保存先」を分け、保存先選択は開けるが実際の submit は full 権限フォルダのみとした。
- API は route handler で `documentGroupHasLegacyExplicitPolicy(body)` を確認し、共有・管理者・visibility 指定時だけ追加 permission を要求する形にした。
- generated docs は手編集せず、`npm run docs:web-inventory` で再生成した。

## 4. 実施した作業

- PR branch に `origin/main` を merge し、Web と generated docs の conflict を解消。
- `DocumentWorkspace` / `DocumentDetailPanel` / `DocumentFilePanel` / `useDocuments` に resource-level full と feature-level permission の guard を追加。
- `DocumentGroup` の `effectivePermission` を使った upload/share/edit/create-parent 制御をテストで固定。
- API route の create 時 permission guard と access-control static test を追加。
- Web inventory / OpenAPI docs check、Web/API test、typecheck、build、coverage を実行。
- push 後の GitHub Actions で web/api lint が fail 判定になったため、CI と同じ lint をローカルで再現し、React Compiler の memo 指摘、未使用 prop、不要 regex escape を修正。

## 5. 成果物

| 成果物 | 形式 | 内容 | 指示との対応 |
|---|---|---|---|
| `apps/web/src/features/documents/components/DocumentWorkspace.tsx` | TSX | create/share/edit/upload の権限制御 | R2/R4/R5 |
| `apps/web/src/features/documents/components/workspace/DocumentDetailPanel.tsx` | TSX | 共有系 create fields disabled、upload 候補 full 限定 | R2/R4 |
| `apps/web/src/features/documents/hooks/useDocuments.ts` | TS | canShare なし create payload の共有系除外 | R2 |
| `apps/api/src/routes/document-routes.ts` | TS | create payload の共有系指定時に assign_manager を要求 | R3 |
| `apps/web/src/features/documents/components/DocumentWorkspace.test.tsx` | TSX test | create/upload/share/edit の権限回帰テスト | R6 |
| `apps/api/src/security/access-control-policy.test.ts` | TS test | API create route の追加 permission guard を静的確認 | R3/R6 |
| `docs/generated/*` | generated docs | Web inventory を再生成 | docs 同期 |
| GitHub Actions lint follow-up | CI 修正 | web/api lint failure をローカル再現し、差分側の lint error を修正 | R7 |

## 6. 指示へのfit評価

| 評価軸 | 評価 | 理由 |
|---|---:|---|
| 指示網羅性 | 5 | 指摘 1〜3 と conflict 解消に対応 |
| 制約遵守 | 5 | worktree/task/report/検証ルールに沿って実施 |
| 成果物品質 | 4 | ローカル主要 check は pass。GitHub Actions gate は push 後確認が残る |
| 説明責任 | 5 | task と report に判断・検証を記録 |
| 検収容易性 | 5 | テスト名と PR コメントで確認可能 |

総合fit: 4.7 / 5.0（約94%）

理由: 実装・単体テスト・ローカル検証は完了。GitHub Actions の最終 green 確認のみ push 後の外部状態に依存する。

## 7. 実行した検証

- `npm run test -w @memorag-mvp/web -- DocumentWorkspace useDocuments`: pass
- `npm run test -w @memorag-mvp/web -- DocumentWorkspace App useDocuments`: pass
- `npm run test:coverage -w @memorag-mvp/web`: pass
- `npm run typecheck -w @memorag-mvp/web`: pass
- `npm run build -w @memorag-mvp/web`: pass
- `npm run test -w @memorag-mvp/api -- access-control-policy`: pass（API workspace の node:test 全体が実行され 287 件 pass）
- `npm run typecheck -w @memorag-mvp/api`: pass
- `npm exec -- eslint apps/web --cache --cache-location .eslintcache-web --max-warnings=0`: fail -> 修正後 pass
- `npm exec -- eslint apps/api --cache --cache-location .eslintcache-api --max-warnings=0`: fail -> 修正後 pass
- `npm run docs:web-inventory:check`: pass
- `npm run docs:openapi:check`: pass
- `git diff --cached --check`: pass
- `rg -n "^(<<<<<<<|=======|>>>>>>>)" apps docs tasks --glob '!reports/**'`: pass

## 8. 未対応・制約・リスク

- GitHub Actions の `acceptance-and-coverage / gate` と `test-results.yml / fail-on-errors_in-test-results` は追加 lint fix の push 後に再確認する。
- `npm ci` 後の `npm audit` は 5 vulnerabilities を報告したが、本タスクの権限修正とは別件のため修正していない。
