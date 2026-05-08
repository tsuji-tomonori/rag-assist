# ローカル性能テストベンチマーク実行手順の確認と skill 化

保存先: `tasks/do/20260509-0051-local-performance-benchmark-skill.md`

状態: do

## 背景

性能テスト担当者用のキーパスを使い、Codex がローカル環境から性能テストのベンチマークを実行し、結果を確認できるか検証する必要がある。

## 目的

ローカルから性能テストベンチマークを実行できるか確認し、実行できた場合は再利用可能な repository-local skill として手順を残す。

## 対象範囲

- ベンチマーク関連の Taskfile / README / docs / scripts
- 既存 benchmark 実行コマンド
- 新規または更新する `skills/*/SKILL.md`
- 作業完了レポート

## 方針

- キーパスの内容は標準出力、コミット、PR、レポート、skill に書き込まない。
- 既存の Taskfile コマンドと運用ドキュメントを優先して実行手順を特定する。
- 実行に成功した場合のみ、秘密情報を含まない形で skill 化する。
- 実行できない場合は blocked / partially complete として原因と試行内容を記録する。

## 必要情報

- ユーザー指定のキーパスファイルはローカルファイルとして扱い、内容を記録しない。
- GitHub Apps / PR 操作が必要な場合は repository skill の手順に従う。

## 実行計画

1. ベンチマーク関連の既存コマンド、README、docs、scripts を確認する。
2. キーパスファイルの存在と読み取り可否のみ確認する。
3. 秘密情報を表示しない方法でローカル benchmark を実行する。
4. 結果の保存先と確認方法を確認する。
5. 成功した場合、実行手順を repository-local skill として追加する。
6. 変更範囲に応じた検証を実行し、作業レポートを作成する。
7. commit / push / PR / PR コメントを可能な範囲で完了する。

## ドキュメントメンテナンス計画

- 新規 skill に、秘密情報を記載しない実行手順、結果確認、失敗時の扱いを明記する。
- README や運用 docs の既存手順を変更する必要があるか確認し、不要なら作業レポートに理由を残す。

## 受け入れ条件

- キーパス情報そのものが repository ファイル、commit message、PR 本文、PR コメント、作業レポート、最終回答に含まれていない。
- ローカルから性能テスト benchmark を実行できるか確認済みで、結果が pass / fail / blocked として記録されている。
- 実行できた場合、再実行手順と結果確認手順を含む repository-local skill が追加されている。
- 変更後に `git diff --check` と、変更した skill の frontmatter / path inspection を実行している。
- 作業完了レポートが `reports/working/` に保存されている。

## 検証計画

- `git diff --check`
- 変更した `SKILL.md` の frontmatter と参照パス確認
- 実行可能な場合、該当 benchmark コマンドの実行結果確認

## PRレビュー観点

- 秘密情報が差分・レポート・PR 文面に含まれていないこと。
- skill が既存 repository-local skill の形式に沿っていること。
- ベンチマーク結果の確認手順が実行者に再現可能であること。
- 未実施検証や実行制約が実施済みとして書かれていないこと。

## 未決事項・リスク

- キーパスが外部サービスや AWS 実アカウントに接続する場合、コマンド実行は環境・権限・コスト・外部状態の制約を受ける。
- benchmark が長時間または高コストの場合、実行範囲を sample / smoke 相当に絞る。

## 実施結果メモ

- キーパスファイルは存在と形式のみ確認し、内容は表示・保存していない。
- 対象 API `https://w2bk6itly9.execute-api.us-east-1.amazonaws.com/prod/health` は認証なしで 401 を返すことを確認した。
- キーパスを bearer token 候補として扱う確認では 401 のままで、ID token としては受理されなかった。
- `aws cloudformation describe-stacks` はローカル AWS credentials が未設定のため実行できず、Cognito client ID は取得できなかった。
- ローカル API を `PORT=18787`、`LOCAL_AUTH_GROUPS=BENCHMARK_RUNNER` で起動し、`API_BASE_URL=http://localhost:18787 task benchmark:sample` が pass した。
- 生成結果は `.local-data/benchmark-results.jsonl`、`.local-data/benchmark-summary.json`、`.local-data/benchmark-report.md`。summary は total 50、succeeded 50、failedHttp 0。
- 成功したローカル実行・結果確認手順を `skills/local-performance-benchmark-runner/SKILL.md` に追加した。
