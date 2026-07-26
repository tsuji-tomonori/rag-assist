# Issue #359 Taskfile alias 廃止 作業レポート

## 受けた指示

Issue #359 の構造負債解消を完了条件まで進める。Phase 1eとして後方互換 `memorag:*` alias 10件を削除し、active referenceを正規task名へ移す。worktree / task / 日本語commit・PR・comment・self-review・final-head CIのrepository workflowに従い、merge / deploy / releaseは行わない。

## 要件整理

- historical reportと完了taskの過去のコマンド文字列は変更しない。
- active workflow / docs / skills / scriptsからlegacy aliasを除く。
- aliasの再導入を自動検出する。
- `task verify`は補助static verificationであり、testを含む最終品質ゲートは`npm run ci`相当のGitHub Actionsとする。
- Taskfile commandの実行前に解決内容を確認し、権限昇格を自動実行しない。

## 検討・判断

単にTaskfileの10 blockを削除するだけでは再導入を検出できないため、active fileだけを走査するdependency-free Node guardを追加した。`reports/working/`、`tasks/**`、`docs/generated/`はguardの走査対象から外し、履歴・taskの説明文をlegacy実行参照として誤検出しない。guardを`npm run ci`と`task verify`の両方へ接続し、local補助検証とGitHub CIのどちらでもfail closedにした。

## 実施作業

- `Taskfile.yml`から`memorag:install`、`memorag:verify`、`memorag:dev:api`、`memorag:dev:web`、`memorag:smoke:api`、`memorag:cdk:test`、`memorag:cdk:synth:yaml`、`memorag:cdk:bootstrap`、`memorag:cdk:deploy:ci`、`memorag:zip`を削除。
- READMEとrepository-local Taskfile skillの例を`task verify`へ更新。
- `scripts/check-taskfile-legacy-aliases.mjs`と`check:taskfile-aliases` npm scriptを追加。
- `task verify`と`npm run ci`の先頭にguardを追加。
- task mdを`tasks/do/`へ追加し、受け入れ条件と検証結果を記録。

## 検証

- intentional README legacy reference probe: 期待どおりexit 1、該当path/lineを表示。fixtureは除去済み。
- `npm run check:taskfile-aliases`: 成功。
- active tree `rg`: legacy alias 0件。
- `task --list`: 成功、legacy alias非掲載。
- `task dev:api --summary`、`task dev:web --summary`、`task smoke:api --summary`: 成功。非破壊summaryのみで、サーバー・external requestは未実行。
- 初回`task verify`: 失敗。worktreeにlocal `node_modules`がなく、shared parentの別branch依存を解決したためcontract/type不整合が発生。変更由来の成功として扱っていない。
- `npm ci`: 成功、504 packages。lockfile変更なし。npmの既存dependency audit summaryは8 vulnerabilities（low 2 / moderate 1 / high 5）。この作業でdependency versionは変更していない。
- isolated install後の`task verify`: 成功。guard、lint、全workspace typecheck、全workspace buildを完走。
- `task docs:check`: 成功。canonical docs、OpenAPI、97 APIs / 582 API documents、Web trace/inventory、infra inventory、hidden Unicodeを確認。
- Draft PR #383: GitHub Appsで作成。作成・label操作は60秒を超えて遅延したが、結果を確認して二重作成・二重labelを避けた。以降のcommentは`gh` fallbackを使用。
- implementation-head MemoRAG CI `29512118687`: 成功。
- Semver: label反映前 `29512118877` はfailure、`semver:patch`付与後 `29512987613` は成功。
- 受け入れ条件 comment `#issuecomment-4993920942`、セルフレビュー `#issuecomment-4993923157`を投稿。
- GitHub Actions final-head CI: task/report lifecycle commit push後に外部証跡として記録予定。

## 成果物

- legacy alias削除とactive reference更新
- active-tree再導入guard
- task mdと本レポート

## 指示への fit 評価

Phase 1eの変更・rollback境界だけに限定し、API/UI/RAG/認可/永続化挙動を変更していない。historical report・完了task・generated docsを一括変更していない。Taskfile commandは解決内容確認後に通常sandboxで実行し、権限昇格、deploy、bootstrap、release、mergeを行っていない。

## 未対応・制約・リスク

- task/report lifecycle commit後のfinal-head CIはこの更新時点では未実施であり、成功扱いにしない。
- npm audit summaryの8 vulnerabilitiesはlockfile既存値で、本taskでは修正していない。別のdependency maintenance scopeが必要。
- `smoke:api`は実サービス起動とdata mutationを伴うため、alias廃止の非破壊検証としては`--summary`まで。API behavior自体は変更していない。
- README / Taskfile / skillのみで、`docs/`正規仕様、generated inventory、API docs、UI trace、security policyへの影響はない。
