# Issue #358 TC-003 execute-api direct endpoint 無効化 作業レポート

## 受けた指示

GitHub Issue #358 の未完了仕様を並行で進め、worktree / task / 実装 / 検証 / 日本語 Draft PR / セルフレビュー / final CI / Issue 進捗まで止めずに完遂する。merge、deploy、release は行わない。

## 要件整理

- production の REST / WebSocket default execute-api endpoint を無効化する。
- CloudFront same-origin 経路を破壊しないよう、REST と WebSocket の別 Regional custom domain、root mapping、DNS alias、CloudFront origin 切替を同一変更にする。
- production context の欠落・不正・region/zone/domain 矛盾は fail closed にする。
- browser/public output へ direct default/custom origin を公開しない。
- 実 AWS の certificate/DNS/reachability は deploy を伴うため自動 test と混同しない。

## 検討・判断

- AWS 公式仕様から、REST / WebSocket の default endpoint 無効化、WebSocket custom domain の Regional 限定と REST/HTTP domain 非共有、API mapping、Route 53 alias の成立条件を確認した。
- Lambda benchmark target に CloudFront domain を渡すと Distribution と API Lambda の循環依存を作るため、production 内部 target は REST custom domain、browser/public output は CloudFront `/api/` に分離した。
- default endpoint 無効化は Regional custom domain を private origin にしないため、origin cloaking 成立済みとは扱わず別の脅威分析として残した。
- README には canonical production deploy command がなく、operator-facing contract は既存の `DES_HLD_002` が正本だったため、README は変更せず同 HLD の production context 表を更新した。

## 実施作業

- production で REST / WebSocket の `DisableExecuteApiEndpoint=true` を設定。
- REST / WebSocket 専用 Regional custom domain、root mapping、Route 53 A alias を追加。
- CloudFront REST / WebSocket origin を custom domain へ切り替え、WebSocket rewrite を root mapping `/` に同期。
- production の domain / certificate ARN region / hosted zone / distinct domain を事前検証。
- public `ApiUrl` / `OpenApiUrl` を CloudFront `/api/` へ変更し、default REST endpoint output を production から除去。
- CDK assertion、negative resolver test、snapshot、generated infra inventory を更新。
- `REQ_TECHNICAL_CONSTRAINT_003`、requirements baseline、change trace、`ARC_ADR_005`、`DES_HLD_002` を同期。
- Draft PR #402 を stacked base `codex/issue-358-tc003-websocket-ticket` 向けに作成し、`semver:patch`、AC コメント、セルフレビューを記録。

## 成果物

- 実装: `infra/lib/memorag-mvp-stack.ts`
- テスト: `infra/test/memorag-mvp-stack.test.ts`、snapshot
- docs: TC-003 REQ、baseline/change trace、ADR/HLD、generated infra inventory
- task: `tasks/done/20260717-1045-issue-358-tc003-direct-endpoint.md`
- PR: https://github.com/tsuji-tomonori/rag-assist/pull/402
- AC: https://github.com/tsuji-tomonori/rag-assist/pull/402#issuecomment-4998348064
- self-review: https://github.com/tsuji-tomonori/rag-assist/pull/402#issuecomment-4998348174

## 検証結果

- `npm ci`: success（504 packages、audit は 2 low / 1 moderate / 5 high。`audit fix` は未実施）
- infra tests: 5/5、stack tests 25 tests success
- 全 workspace typecheck: success
- contract/API/infra build: success
- lint: success
- `task docs:infra-inventory`: success
- `task docs:check`: success
- production `cdk synth`: success。最初の region mismatch、続く CORS / alert context 不足は production guard が拒否し、CLI target `us-east-1` と全 context を一致させて再実行した。
- synthesized template audit: REST/WS disable、2 custom domain、2 mapping、2 alias、CloudFront custom origins、CloudFront public outputs、production benchmark custom target を確認。
- CDK-Nag: error 0。既存 Cognito MFA / REST WAF warning を確認。
- source audit: dataset-specific branch 0、artifact mismatch 0
- pre-commit / `git diff --check`: success
- implementation-head GitHub Actions run `29549225579`: 主要 job success（8m18s）、promotion gate skip
- `task verify`: exit 0 だが出力は lint のみだったため、全 typecheck/build の根拠にはせず個別コマンドと CI を根拠にした。

## 指示への fit 評価

- deliverables: IaC、tests、canonical docs、coverage、generated inventory、task、report、Draft PR を同 branch に配置。
- security: default endpoint bypass を閉じ、production config を fail closed にし、既存 auth/authorization/ticket/redaction を変更していない。
- evidence: source、assertion、synthesized template、full CI を区別して記録し、実環境 gate を自動検証済みにしていない。
- workflow: 専用 worktree、stacked Draft PR、日本語本文/コメント、semver label、AC/self-review を実施。GitHub Apps 操作面が利用できないため `gh` fallback を使用。

## 未対応・制約・リスク

- lifecycle final-head CI、Issue #358 進捗、clean/upstream は本レポートを含む commit 後の外部 gate であり、この時点では未実施。
- 実 AWS/browser の certificate coverage / validation、DNS、default endpoint 403、CloudFront REST、WebSocket 101 / protocol echo は未実施。
- Regional custom domain 自体は direct 到達可能であり、CloudFront 専用 private origin ではない。追加 cloaking は別 threat analysis が必要。
- npm audit の既存 8 件と CDK-Nag の既存 MFA/WAF warning は本タスクの scope 外で未解消。
- merge、deploy、release、DNS / certificate の作成・変更は実施していない。
