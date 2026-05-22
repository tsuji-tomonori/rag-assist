# DynamoDB GSI diff guard

状態: done

## 背景

`HumanQuestionsTable` の CloudFormation 更新で、1 回の更新に複数の GSI 作成/削除が含まれ、DynamoDB の制約により deploy が失敗した。`FavoritesTable` 作成失敗や frontend deploy cancel は rollback の副作用であり、再発防止には CDK synth/typecheck では検出しにくい GSI add/delete 差分を CI で検出する必要がある。

## タスク種別

修正

## なぜなぜ分析サマリ

- confirmed: CloudFormation / DynamoDB は既存 table の GSI 作成/削除を 1 回の更新で複数扱うと失敗し得る。
- confirmed: 今回の直接原因は `HumanQuestionsTable` に対して複数の GSI 作成/削除が同一更新に含まれたこと。
- inferred: 現行 CI は CDK テンプレート生成と単体テストを実行するが、base template と PR template の GSI add/delete 件数を比較していないため、deploy 時まで検出できない。
- open_question: 実環境の現行 template と repository snapshot が完全一致しているかはこの作業では検証しない。
- root cause: 既存 DynamoDB table の GSI add/delete 差分を PR 段階で reject する静的ガードが不足している。
- remediation: base/current の CloudFormation template から `AWS::DynamoDB::Table.GlobalSecondaryIndexes` の index 名を比較し、既存 table の GSI add/delete が同一 table で 2 件以上なら fail する CI ガードと単体テストを追加する。

## 目的

既存 DynamoDB table に対する複数 GSI add/delete を PR/CI で検出し、CloudFormation deploy 失敗を事前に防ぐ。

## スコープ

- `AWS::DynamoDB::Table.GlobalSecondaryIndexes` の add/delete 件数チェックを追加する。
- 新規 table 作成時の複数 GSI は許容する。
- GSI throughput や contributor insights など、index 名の追加/削除ではない変更は許容する。
- 実 deploy の段階分割自体はこの PR では行わない。

## 実装計画

1. CloudFormation template 差分を読み、table logical id ごとの GSI index 名 add/delete 件数を判定する script を追加する。
2. 指定された acceptance criteria に沿う node:test を追加する。
3. CI workflow に PR base snapshot と current snapshot の比較ステップを追加する。
4. 必要な npm script を追加する。
5. targeted test/typecheck と diff check を実行する。
6. 作業レポート、commit、PR、受け入れ条件コメント、セルフレビューコメントまで実施する。

## ドキュメント保守方針

運用者向けの恒久手順変更は CI workflow と script 自体で表現される。README/docs の利用手順には影響しない想定。必要に応じて作業レポートと PR 本文に、実 deploy は GSI ごとの段階分割が必要であることを明記する。

## 受け入れ条件

- existing table に GSI が 1 件追加された diff は pass する。
- existing table に GSI が 2 件追加された diff は fail する。
- existing table に GSI が 1 件削除された diff は pass する。
- existing table に GSI 追加 1 件 + 削除 1 件がある diff は fail する。
- 新規 DynamoDB table 作成時に複数 GSI を持つ場合は pass する。
- GSI の throughput / contributor insights など非作成削除系の変更は pass する。
- CI workflow が PR の base/current template を比較するステップを持つ。
- 実行した検証と未実施の検証を PR 本文・コメント・作業レポートに正直に記録する。

## 検証計画

- `npm test -w @memorag-mvp/infra`
- `npm run typecheck -w @memorag-mvp/infra`
- `git diff --check`

## PR レビュー観点

- 新規 table 作成を誤検出しないこと。
- GSI のプロパティ変更を add/delete と誤検出しないこと。
- CI が workflow_dispatch でも過剰に失敗しないこと。
- deploy 実行や外部 AWS 状態変更を含まないこと。

## リスク

- repository snapshot と実環境 template がずれている場合、CI は実環境との差分を完全には検出できない。この制約は PR 本文・作業レポートに明記する。
