# benchmark CodeBuild suite manifest 化

状態: in_progress

## 背景

CDK で CodeBuild benchmark runner を扱っているが、ベンチマーク suite が増えるたびに CDK の buildspec やテストに suite 固有の変更が入り、インフラ差分が不要に発生している。

## 目的

CDK は固定の実行基盤に寄せ、suite 固有の dataset/corpus/prepare/run 設定は repository 内 manifest と benchmark package 側で解決する。新しい suite 追加時に CDK 変更が不要な構造へ近づける。

## スコープ

- CodeBuild runner から suite 固有の shell 分岐を削減または除去する。
- benchmark package に suite manifest と CI/CodeBuild 用の解決処理を追加する。
- 既存 suite の実行設定を manifest に移す。
- 既存の CodeBuild/API 実行契約を壊さない範囲で buildspec を固定化する。
- 関連するテストと運用ドキュメントを更新する。

## 実施計画

1. 既存 CDK CodeBuild buildspec、benchmark runner、suite 定義、API 起動経路を確認する。
2. `benchmark/suites.yaml` などの manifest と resolver を追加する。
3. CodeBuild buildspec を manifest resolver 呼び出しへ変更する。
4. suite 固有の path/env/prepare/run コマンドを manifest に移す。
5. unit test / CDK assertion test / docs を更新する。
6. 変更範囲に対する検証を実行する。
7. 作業レポート、commit、PR、PR コメントまで進める。

## ドキュメント保守方針

CodeBuild benchmark runner の運用・suite 追加手順が変わるため、`memorag-bedrock-mvp/docs/` または既存運用文書の該当箇所を確認し、必要最小限の追記を行う。

## 受け入れ条件

- [ ] CodeBuild buildspec に個別 suite 名を列挙しない。
- [ ] benchmark suite 追加時は manifest 変更で dataset/corpus/prepare/run 設定を表現できる。
- [ ] 既存 suite の `BENCHMARK_SUITE_ID` / `BENCHMARK_MODE` 入力から従来相当の dataset、corpus、runner command が解決される。
- [ ] CDK assertion test が suite 固有分岐の除去を検証する。
- [ ] benchmark package の resolver/entrypoint に unit test がある。
- [ ] 関連ドキュメントに suite 追加手順または CodeBuild 固定化方針が記載される。
- [ ] 変更範囲に応じた検証コマンドを実行し、未実施があれば理由を記録する。

## 検証計画

- `git diff --check`
- `npm --prefix memorag-bedrock-mvp run typecheck -w @memorag-mvp/benchmark`
- `npm --prefix memorag-bedrock-mvp run test -w @memorag-mvp/benchmark`
- `task memorag:cdk:test`
- 必要に応じて infra typecheck または targeted test を追加する。

## PR レビュー観点

- CDK が suite 固有情報を持たないこと。
- CodeBuild の env / artifact / metrics 更新契約が維持されること。
- 新 suite 追加時の manifest 記述が十分に表現力を持つこと。
- benchmark 期待語句・dataset 固有分岐が実装の RAG 経路に混入していないこと。
- docs と実装・テストが同期していること。

## リスク

- buildspec の shell 依存を変えるため、CodeBuild 環境での env propagation を壊す可能性がある。
- 既存 suite の prepare command の実行順を誤ると benchmark dataset/corpus が不足する可能性がある。
- Taskfile の広い検証は時間がかかる可能性がある。
