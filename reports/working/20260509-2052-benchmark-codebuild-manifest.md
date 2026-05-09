# 作業完了レポート

保存先: `reports/working/20260509-2052-benchmark-codebuild-manifest.md`

## 1. 受けた指示

- 主な依頼: CDK で扱う CodeBuild benchmark runner が benchmark suite 追加のたびに変更される問題を、repo 側設定で扱えるようにする。
- 成果物: CodeBuild suite manifest、benchmark package の resolver/entrypoint、CDK buildspec の固定化、テスト、運用ドキュメント更新。
- 条件: 計画だけで止めず実装・検証まで進める。実施していない検証を実施済みにしない。

## 2. 要件整理

| 要件ID | 指示・要件 | 重要度 | 対応状況 |
|---|---|---:|---|
| R1 | CodeBuild buildspec に suite 固有の条件分岐を残さない | 高 | 対応 |
| R2 | suite 追加時の dataset/corpus/prepare/run 設定を manifest に寄せる | 高 | 対応 |
| R3 | 既存 suite の runner 選択を維持する | 高 | 対応 |
| R4 | CDK と benchmark package のテストを更新する | 高 | 対応 |
| R5 | 運用ドキュメントを更新する | 中 | 対応 |
| R6 | 検証結果と制約を記録する | 高 | 対応 |

## 3. 検討・判断したこと

- CDK は CodeBuild project、IAM、artifact upload、固定 buildspec だけを持ち、suite 固有情報は `benchmark/suites.codebuild.json` に移す方針を採用した。
- YAML parser 依存を増やさないため、現時点の manifest は JSON とした。論理的には suite manifest であり、後続で YAML 化しても CodeBuild 側の固定化方針は変わらない。
- CodeBuild の shell env を親 process に戻す必要を避けるため、prepare と run を `codebuild-suite.ts` に分け、それぞれが manifest から同じ env を再構成する形にした。
- API の `GET /benchmark-suites` は今回の主対象外とし、CodeBuild 実行基盤側の suite 固有分岐除去を優先した。新 suite を UI/API に表示する場合は従来どおり API metadata 更新も必要。

## 4. 実施した作業

- `benchmark/suites.codebuild.json` を追加し、既存 CodeBuild 対象 suite の dataset source、corpus、prepare script、runner を宣言した。
- `benchmark/codebuild-suite.ts` を追加し、manifest load、suite resolve、prepare 実行、agent/search/conversation runner 起動を実装した。
- `benchmark/package.json` に `codebuild:prepare` と `codebuild:run` を追加した。
- CDK buildspec から suite 固有の `if/elif` を除去し、固定コマンドへ差し替えた。
- benchmark resolver test と CDK assertion/snapshot test を更新した。
- `docs/OPERATIONS.md` に manifest による suite 追加方針と CodeBuild 固定化方針を追記した。

## 5. 成果物

| 成果物 | 形式 | 内容 | 指示との対応 |
|---|---|---|---|
| `memorag-bedrock-mvp/benchmark/suites.codebuild.json` | JSON | CodeBuild benchmark suite manifest | suite 追加時の設定置き場 |
| `memorag-bedrock-mvp/benchmark/codebuild-suite.ts` | TypeScript | prepare/run resolver | buildspec 固定化 |
| `memorag-bedrock-mvp/benchmark/codebuild-suite.test.ts` | TypeScript test | resolver の単体検証 | 既存 suite 解決の担保 |
| `memorag-bedrock-mvp/infra/lib/memorag-mvp-stack.ts` | CDK | CodeBuild buildspec の固定化 | CDK 差分削減 |
| `memorag-bedrock-mvp/docs/OPERATIONS.md` | Markdown | 運用・追加手順の更新 | docs 同期 |

## 6. 指示へのfit評価

| 評価軸 | 評価 | 理由 |
|---|---:|---|
| 指示網羅性 | 4.5/5 | CodeBuild の suite 固有分岐を manifest に移し、主要目的を満たした。 |
| 制約遵守 | 4.5/5 | worktree/task/report/検証を実施。API suite metadata の manifest 統合は今回範囲外として明記した。 |
| 成果物品質 | 4.5/5 | 既存 suite を manifest 化し、resolver と CDK test を追加した。 |
| 説明責任 | 5/5 | 採用方針、未対応、検証結果を記録した。 |
| 検収容易性 | 4.5/5 | 変更点とコマンドが追跡しやすい。 |

総合fit: 4.6 / 5.0（約92%）

理由: CDK の suite 固有変更を避ける中核要件は満たした。API 側の suite 一覧まで manifest へ統合する作業は、今回の CodeBuild 固定化とは別の後続改善として残る。

## 7. 実行した検証

- `npm ci`: pass。worktree に依存関係がなかったため実行。
- `npm --prefix memorag-bedrock-mvp run typecheck -w @memorag-mvp/benchmark`: pass。
- `npm --prefix memorag-bedrock-mvp run test -w @memorag-mvp/benchmark`: pass。
- `UPDATE_SNAPSHOTS=1 node --test -r ts-node/register test/memorag-mvp-stack.test.ts`: pass。CDK snapshot 更新のため実行。
- `task memorag:cdk:test`: pass。
- `git diff --check`: pass。

## 8. 未対応・制約・リスク

- API の `benchmarkSuites` 一覧は今回 manifest 共通化していない。新 suite を管理画面/API に表示する場合は API metadata 更新が別途必要。
- `npm ci` 後に `npm audit` が 3 件の既存 vulnerability を報告したが、依存更新は今回の目的外のため未対応。
- CodeBuild 実環境での外部 dataset download、S3 copy、Cognito token 解決は単体テストでは実行していない。既存の CDK/benchmark unit test と buildspec assertion で契約を確認した。
