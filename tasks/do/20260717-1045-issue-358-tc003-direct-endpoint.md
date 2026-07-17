# Issue #358 TC-003 execute-api direct endpoint 無効化

- 状態: do
- タスク種別: セキュリティ設定変更
- 作成日: 2026-07-17
- 起点: `codex/issue-358-tc003-websocket-ticket` final head `f3b66346`
- branch: `codex/issue-358-tc003-direct-endpoint`
- 関連要件: `TC-003`

## 背景・目的

TC-003 段階6として、REST API と WebSocket API の AWS 既定 `execute-api` endpoint を production 相当構成で無効化し、ブラウザの公開入口を CloudFront same-origin の `/api` / `/api/*` / `/ws/v1` に限定する。CloudFront origin まで同時に切り替え、既定 endpoint を無効化した結果 CloudFront 経由も停止する不整合を作らない。

実 AWS での到達不能確認は deploy と外部状態変更を伴うため、本タスクでは source、CDK assertion、synthesized template、SPA artifact、CI を自動 evidence とし、実環境確認を preview gate として明示する。

## 初期問題文

段階5の final source は SPA へ direct REST / WebSocket URL を配布しないが、API Gateway の既定 `execute-api` endpoint 自体は有効である。CloudFront origin もその既定 endpoint に依存するため、単純に disable flag を設定すると same-origin 経路まで破壊する。既定 endpoint を無効化しながら CloudFront origin を維持するための API Gateway custom domain / API mapping / certificate / DNS 契約を確定し、fail closed に構成する必要がある。

## 実装チェックリスト

- [ ] AWS 公式仕様と current IaC を確認し、REST / WebSocket の default endpoint disable と custom domain mapping の成立条件を確定する。
- [ ] production 相当構成の必須入力、certificate region、domain ownership、CloudFront origin protocol / path を fail closed に定義する。
- [ ] REST API と WebSocket API の既定 endpoint を production 相当構成で無効化する。
- [ ] CloudFront の REST / WebSocket origin を API Gateway custom origin へ切り替え、既存 path rewrite と same-origin behavior を維持する。
- [ ] non-production の明示的な例外を設ける場合は既定値を安全側にし、production での欠落・不正値・fallback を synth 前に拒否する。
- [ ] CDK assertion、negative config、snapshot / generated inventory、SPA artifact のテストを追加・更新する。
- [ ] ADR / HLD / 要件 coverage を実装と同期する。
- [ ] selected / full validation、Draft PR、AC/self-review、task/report lifecycle、final-head CI、Issue #358 進捗まで完了する。

## 受け入れ条件

- [ ] production 相当 synth で REST API と WebSocket API の `DisableExecuteApiEndpoint` が有効である。
- [ ] CloudFront の `/api` / `/api/*` / `/ws/v1` は disable 済み default endpoint ではなく、明示された API Gateway custom origin と API mapping を利用する。
- [ ] REST と WebSocket の custom domain、certificate、API mapping / stage の対応が曖昧または欠落した production 構成は synth 前または synth 時に fail closed となる。
- [ ] SPA runtime config / built artifact / CloudFormation output に browser 用 direct `execute-api` URL を追加しない。
- [ ] CloudFront の REST error と SPA rewrite の分離、WebSocket exact path / upgrade header / stage rewrite、Hosted UI / PKCE、CORS allowlist を後退させない。
- [ ] direct endpoint disable は source と synthesized template の双方で自動検証され、意図的に false / 欠落へ戻すと test が失敗する。
- [ ] REST / WebSocket の既存 auth、tenant/session binding、single-use ticket、logging redaction、authorization policy を弱めない。
- [ ] RAG の根拠性、benchmark / QA sample / dataset 固有分岐を production runtime へ追加しない。
- [ ] canonical docs、coverage、snapshot、generated infra inventory が source と同期する。
- [ ] selected local validation と implementation-head / lifecycle final-head CI が成功し、未解決 failure がない。
- [ ] 実 AWS/browser での default endpoint 到達不能、CloudFront REST / WebSocket 疎通を未実施なら pass とせず、preview gate と残存リスクに記録する。
- [ ] 日本語 Draft PR、`semver:patch`、受け入れ条件コメント、セルフレビュー、Issue #358 進捗、clean/upstream 一致まで完了する。

## 検証計画

- targeted infra configuration / REST API / WebSocket API / CloudFront CDK assertions
- production missing / malformed custom domain and certificate negative tests
- existing CloudFront REST, Hosted UI, CORS, WebSocket ticket / authorizer regression tests
- synthesized template audit for disabled default endpoints, custom origins, mappings, logging / secret leakage
- SPA runtime / build artifact audit for `execute-api` direct URLs
- infra full test / typecheck / build / synth、API selected/full test / typecheck / build
- `task docs:check`、`task verify`、source audit、`git diff --check`
- GitHub Actions full CI and semver validation

## ドキュメント保守計画

- TC-003 の canonical ADR / HLD に段階6の default endpoint disable、custom origin、certificate / DNS prerequisite、rollback、preview gate を記録する。
- 要件 coverage と generated infra inventory / snapshot を正規 generator で同期する。
- README / 運用手順への production configuration 影響を確認し、必要な設定が operator-facing なら同じ PR で更新する。

## リスク・blocking / rollback 境界

- API Gateway default endpoint を無効化すると既存 `execute-api` CloudFront origin も利用不能になる。custom domain / mapping を同時に成立させられない場合は disable flag だけを先行せず blocked とする。
- certificate / DNS ownership は deploy-time external state を必要とする。本タスクでは IaC 契約と synth までを実装し、実 certificate / DNS / reachability は preview gate とする。
- custom domain 自体の direct 到達可能性と「browser が direct origin を利用しない」要件を混同しない。追加の origin cloaking が必要なら AWS サービス対応範囲を公式仕様で確認し、未成立を明記する。
- rollback は custom domain / mapping / CloudFront origin / disable flag を同じ単位で戻し、REST / WebSocket の片側だけを default endpoint 無効のまま残さない。
- merge、deploy、release、DNS / certificate 作成・変更は実施しない。

## Done 条件

- deliverables: IaC、tests、canonical docs、coverage、生成物、task、作業レポート、Draft PR 証跡が同じ branch に揃う。
- validations: 選択した local checks と final-head GitHub CI が成功し、未解決の blocking self-review 指摘がない。
- lifecycle: task を `tasks/done/` へ移動して final lifecycle commit を push し、その head の CI と Issue #358 コメントを確認する。
- honesty: 実 AWS/browser、DNS / certificate、direct endpoint reachability の未検証を pass としない。
