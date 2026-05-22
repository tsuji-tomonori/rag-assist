# 作業完了レポート

保存先: `reports/working/20260522-1930-dynamodb-gsi-diff-guard.md`

## 1. 受けた指示

- 主な依頼: `HumanQuestionsTable` の複数 GSI 作成/削除による CloudFormation deploy 失敗を踏まえ、既存 DynamoDB table の GSI add/delete が複数ある template diff を CI で reject するガードを追加する。
- 成果物: 差分検査 script、CI workflow への組み込み、単体テスト、task md、作業レポート。
- 条件: 実施していない検証を実施済み扱いしない。既存 worktree の未コミット変更を混ぜない。

## 2. 要件整理

| 要件ID | 指示・要件 | 重要度 | 対応状況 |
|---|---|---:|---|
| R1 | existing table の GSI 1 件追加は pass | 高 | 対応 |
| R2 | existing table の GSI 2 件追加は fail | 高 | 対応 |
| R3 | existing table の GSI 1 件削除は pass | 高 | 対応 |
| R4 | existing table の GSI 追加 1 件 + 削除 1 件は fail | 高 | 対応 |
| R5 | 新規 table の複数 GSI は pass | 高 | 対応 |
| R6 | GSI の非 add/delete 変更は pass | 高 | 対応 |
| R7 | CI で base/current template diff を検査 | 高 | 対応 |

## 3. 検討・判断したこと

- deploy 分割の実行ではなく、再発防止の CI ガードに変更範囲を絞った。
- `AWS::DynamoDB::Table` の logical id ごとに `GlobalSecondaryIndexes[].IndexName` を比較し、add/delete 件数のみを判定対象にした。
- 新規 table は CloudFormation の既存 table 更新制約の対象ではないため、比較元に同一 logical id がない場合は許容した。
- GSI throughput などの index 名が変わらない変更は、今回の CloudFormation 制約の直接対象ではないため許容した。
- CI は PR 時に base branch の CDK snapshot と current snapshot を比較する。実環境の現行 template と repository snapshot のずれは、この PR では検出対象外とした。

## 4. 実施した作業

- `tasks/do/20260522-0855-dynamodb-gsi-diff-guard.md` を作成し、受け入れ条件と RCA サマリを記載した。
- `infra/lib/dynamodb-gsi-update-limit.ts` に GSI add/delete 差分検査ロジックを追加した。
- `infra/scripts/check-dynamodb-gsi-update-limit.ts` に CLI を追加し、npm script から実行できるようにした。
- `infra/test/dynamodb-gsi-update-limit.test.ts` に指定された 6 観点の単体テストを追加した。
- `.github/workflows/memorag-ci.yml` に DynamoDB GSI update limit guard step を追加し、CI result comment と fail 条件に反映した。
- `infra/tsconfig.json` の include に `scripts/**/*.ts` を追加し、CLI も typecheck 対象にした。

## 5. 成果物

| 成果物 | 形式 | 内容 | 指示との対応 |
|---|---|---|---|
| `infra/lib/dynamodb-gsi-update-limit.ts` | TypeScript | 既存 table の GSI add/delete 件数検査 | CI ガード中核 |
| `infra/scripts/check-dynamodb-gsi-update-limit.ts` | TypeScript CLI | template JSON 2 件を比較して違反時に exit 1 | CI 実行コマンド |
| `infra/test/dynamodb-gsi-update-limit.test.ts` | node:test | 受け入れ条件 6 観点の単体テスト | 完了条件に対応 |
| `.github/workflows/memorag-ci.yml` | GitHub Actions | PR base/current snapshot 比較 step を追加 | CI ガードに対応 |
| `tasks/do/20260522-0855-dynamodb-gsi-diff-guard.md` | Markdown | 作業 task と受け入れ条件 | Worktree Task PR Flow に対応 |

## 6. 指示へのfit評価

| 評価軸 | 評価 | 理由 |
|---|---:|---|
| 指示網羅性 | 5 | 指定された単体テスト観点と CI ガードを実装した。 |
| 制約遵守 | 4 | 専用 worktree で作業した。途中で sandbox 実行バイナリ不備があり、一部機械的編集は `apply_patch` ではなくコマンドで行った。 |
| 成果物品質 | 4 | GSI 名の add/delete に限定して誤検出を抑えた。実環境 template との差分検査は対象外。 |
| 説明責任 | 5 | 未検証・制約を task md とレポートに記録した。 |
| 検収容易性 | 5 | 単体テストと CI step で受け入れ条件を確認できる。 |

総合fit: 4.6 / 5.0（約92%）
理由: 主要要件は満たしたが、CI の比較元は repository snapshot であり、実環境 template とのずれまではこの作業で解決していないため満点ではない。

## 7. 検証結果

### 実行した検証

- `npm ci`: pass。依存関係未インストールによる初回 test/typecheck 失敗後に実行。
- `npm test -w @memorag-mvp/infra`: 初回は `.mjs` import 型不足、2 回目は test fixture 型不一致で fail。修正後 pass。
- `npm run typecheck -w @memorag-mvp/infra`: pass。
- `npm exec -- eslint infra --cache --cache-location .eslintcache-infra --max-warnings=0`: pass。
- `npm run check:dynamodb-gsi-update-limit -w @memorag-mvp/infra -- test/__snapshots__/memorag-mvp-stack.snapshot.json test/__snapshots__/memorag-mvp-stack.snapshot.json`: 初回は workspace cwd と path の不一致で fail。workflow path 修正後 pass。
- `git diff --check`: pass。

### 未実施・制約

- `cdk deploy`: 未実施。外部 AWS 環境を変更する deploy は今回の CI ガード実装範囲外。
- 実環境の現行 CloudFormation template との差分確認: 未実施。CI では PR base の repository snapshot と current snapshot を比較する。

## 8. 未対応・リスク

- 実際の今回の deploy を通すには、ユーザー提示どおり GSI 変更を 1 件ずつに分割して deploy する必要がある。
- repository snapshot が実環境の deployed template とずれている場合、CI ガードは実環境との差分を完全には検出できない。
