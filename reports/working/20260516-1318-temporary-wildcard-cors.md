# 作業完了レポート

保存先: `reports/working/20260516-1318-temporary-wildcard-cors.md`

## 1. 受けた指示

- 主な依頼: production Lambda が `CORS_ALLOWED_ORIGINS must not include * in production` で落ちているため、いったん CORS を `*` にする。
- 成果物: API runtime config / test の修正、task md、作業レポート、PR。
- 形式・条件: repository local workflow に従い、実施していない検証を実施済みとして書かない。

## 2. 要件整理

| 要件ID | 指示・要件 | 重要度 | 対応状況 |
|---|---|---:|---|
| R1 | production `CORS_ALLOWED_ORIGINS=*` で起動できる | 高 | 対応 |
| R2 | production CORS 未設定は引き続き拒否する | 高 | 対応 |
| R3 | public allowlist / `OPTIONS` / `Last-Event-ID` 境界を壊さない | 高 | 対応 |
| R4 | 一時措置の残リスクを記録する | 高 | 対応 |
| R5 | 対象検証を実行する | 高 | 対応 |

## 3. 検討・判断したこと

- 直接原因は、CDK が `CORS_ALLOWED_ORIGINS=*` を設定している一方で、runtime config が production wildcard を拒否していたこと。
- `docs/OPERATIONS.md` と API 設計 docs は既に独自ドメイン未確定期間の一時 `*` 許容を記載していたため、docs ではなく実装・テストを既存運用方針へ同期した。
- CORS は認証・認可境界ではないため、`AUTH_ENABLED=true`、Cognito 必須、route-level permission は維持した。

## 4. 実施した作業

- `apps/api/src/config.ts` から production wildcard CORS 拒否を削除した。
- `apps/api/src/contract/api-hardening.test.ts` を production wildcard 許容の期待に更新した。
- `apps/api/src/security/access-control-policy.test.ts` を public allowlist / preflight / `Last-Event-ID` 境界維持と CORS 明示指定確認の期待に更新した。
- task md に RCA、受け入れ条件、検証結果を記録した。

## 5. 成果物

| 成果物 | 形式 | 内容 | 指示との対応 |
|---|---|---|---|
| `apps/api/src/config.ts` | TypeScript | production `CORS_ALLOWED_ORIGINS=*` の一時許容 | R1 |
| `apps/api/src/contract/api-hardening.test.ts` | Test | wildcard CORS 許容の回帰テスト | R1/R2 |
| `apps/api/src/security/access-control-policy.test.ts` | Test | middleware 境界と CORS 明示指定の静的確認 | R3 |
| `tasks/do/20260516-1318-temporary-wildcard-cors.md` | Markdown | task md / RCA / acceptance / validation | workflow |
| `reports/working/20260516-1318-temporary-wildcard-cors.md` | Markdown | 作業完了レポート | R4 |

## 6. 指示へのfit評価

| 評価軸 | 評価 | 理由 |
|---|---:|---|
| 指示網羅性 | 5/5 | production wildcard CORS 起動失敗の直接原因を修正した。 |
| 制約遵守 | 5/5 | repository workflow、RCA、task md、検証記録に従った。 |
| 成果物品質 | 4/5 | 一時措置としては十分だが、恒久的には allowlist へ戻す必要がある。 |
| 説明責任 | 5/5 | 既存 docs との同期、残リスク、未対応を明記した。 |
| 検収容易性 | 5/5 | test / typecheck / diff check の結果を記録した。 |

総合fit: 4.8 / 5.0（約96%）

理由: 依頼された一時 `*` 許容と起動失敗解消は満たした。独自ドメイン確定後に具体 origin allowlist へ戻す運用タスクは残る。

## 7. 実行した検証

- `npm ci`: pass。worktree に依存関係がなかったため実行。npm audit は既存依存で 4 件の vulnerability を報告。
- `npm run test -w @memorag-mvp/api -- src/contract/api-hardening.test.ts src/security/access-control-policy.test.ts`: pass。script の glob により API tests 248 件が実行された。
- `npm run typecheck -w @memorag-mvp/api`: pass。
- `git diff --check`: pass。

## 8. 未対応・制約・リスク

- `CORS_ALLOWED_ORIGINS=*` は任意 origin からブラウザ経由の API 呼び出しを許可するため、外部公開面は広がる。
- 機微データ保護は Cognito JWT 認証と route-level permission に依存する。
- ドメイン確定後に `CORS_ALLOWED_ORIGINS` を具体 origin allowlist へ戻す必要がある。
- npm audit の 4 件は今回の CORS 起動失敗とは別件として扱った。
