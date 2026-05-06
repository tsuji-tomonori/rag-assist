# 回答担当・性能テスト担当の権限アクセス不具合修正

状態: done

## 背景

ユーザーから「権限において、回答担当や性能テスト担当にしても、その機能へアクセスできなかった。原因を確認し、障害レポートを作成したうえで修正して」と依頼された。

## 目的

回答担当ロールおよび性能テスト担当ロールに割り当てたユーザーが、想定される担当者回答機能または性能テスト機能へアクセスできるようにする。

## スコープ

- API / Web の認可境界、role permission、表示制御、テストの調査。
- 原因を `reports/bugs/` の障害レポートとして記録する。
- 必要最小限の修正と回帰テストを追加・更新する。
- 関連ドキュメントの更新要否を確認する。

## 計画

1. 現行の role permission と Web の機能表示条件を調査する。
2. 回答担当・性能テスト担当でアクセスできない再現条件を特定する。
3. 原因、影響、対応方針を障害レポートへ記録する。
4. API / Web の必要箇所を修正し、権限の最小性を確認する。
5. 対象テストを実行し、失敗時は修正して再実行する。
6. 作業完了レポート、commit、push、PR、PR コメントまで実施する。

## ドキュメント保守計画

- 権限定義やユーザー可視のアクセス挙動が変わる場合は、関連する `memorag-bedrock-mvp/docs/`、README、API 例の更新要否を確認する。
- 一時的な調査結果は `reports/bugs/` と `reports/working/` に記録し、恒久仕様と混同しない。

## 受け入れ条件

- AC-001: 回答担当ロールで担当者回答機能へアクセスできなかった原因が、ファイル・テスト根拠付きで説明されている。
- AC-002: 性能テスト担当ロールで性能テスト機能へアクセスできなかった原因が、ファイル・テスト根拠付きで説明されている。
- AC-003: 原因、影響、対応、再発防止を含む障害レポートが `reports/bugs/` に作成されている。
- AC-004: 回答担当ロールが担当者回答に必要な route / UI へアクセスできることをテストで確認している。
- AC-005: 性能テスト担当ロールが性能テストに必要な route / UI へアクセスできることをテストで確認している。
- AC-006: 変更範囲に見合う API / Web / diff 検証を実行し、未実施の検証があれば理由を記録している。
- AC-007: PR 作成後、受け入れ条件確認コメントとセルフレビューコメントを日本語で投稿している。

## 検証計画

- `git diff --check`
- API 権限テスト: `npm --prefix memorag-bedrock-mvp run test -w @memorag-mvp/api`
- Web 権限制御または関連 UI テスト: 変更範囲に応じて `npm --prefix memorag-bedrock-mvp run test -w @memorag-mvp/web`
- 必要に応じて型チェックまたは lint。

## PR レビュー観点

- docs と実装の同期。
- 変更範囲に見合うテスト。
- RAG の根拠性・認可境界を弱めていないこと。
- 回答担当・性能テスト担当に不要な管理者権限を広げていないこと。

## リスク

- UI の表示条件と API の permission が別々に定義されている場合、片方だけ直すと再発する。
- local auth と Cognito group のロール名がずれている場合、テストでは通っても実環境で再現する可能性がある。
- 性能テスト機能には CodeBuild / artifact / 履歴取得など複数 route があり、必要権限の漏れを網羅する必要がある。

## 完了結果

- PR: https://github.com/tsuji-tomonori/rag-assist/pull/140
- commit: `ab9d3bf`
- 障害レポート: `reports/bugs/20260506-2303-role-assignment-access-denied.md`
- 作業完了レポート: `reports/working/20260506-2317-role-access-fix.md`

## 受け入れ条件の確認結果

- AC-001: 満たした。根拠: 障害レポートに `assignUserRoles()` が管理台帳だけを更新していたことを記録。
- AC-002: 満たした。根拠: 障害レポートに `BENCHMARK_RUNNER` と Web の `benchmark:read` / `benchmark:run` 要件のずれを記録。
- AC-003: 満たした。根拠: `reports/bugs/20260506-2303-role-assignment-access-denied.md`。
- AC-004: 満たした。根拠: API test の `answer editors can list questions without user administration permission` と Web role navigation test。
- AC-005: 満たした。根拠: API test の `benchmark operators can use benchmark run administration without direct query permission` と Web role navigation test。
- AC-006: 満たした。根拠: API / Web / Infra test、typecheck、`git diff --check` を実行。
- AC-007: 満たした。根拠: PR #140 に受け入れ条件確認コメントとセルフレビューコメントを投稿。

## 実行した検証

- `npm --prefix memorag-bedrock-mvp ci`: pass
- `UPDATE_SNAPSHOTS=1 npm --prefix memorag-bedrock-mvp run test -w @memorag-mvp/infra`: pass
- `npm --prefix memorag-bedrock-mvp run test -w @memorag-mvp/api`: pass
- `npm --prefix memorag-bedrock-mvp run test -w @memorag-mvp/web`: pass
- `npm --prefix memorag-bedrock-mvp run typecheck --workspaces --if-present`: pass
- `git diff --check`: pass

## 未実施

- 実 AWS 環境 smoke は未実施。CDK deploy 後に `BENCHMARK_OPERATOR` group 作成と対象ユーザー再ログイン後の permission 反映確認が必要。
- `task docs:check:changed` は task が存在しないため未実施。
