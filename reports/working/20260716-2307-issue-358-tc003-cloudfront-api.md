# Issue #358 TC-003 CloudFront REST API behavior 作業完了レポート

- 作成日時: 2026-07-16 23:07 JST
- branch: `codex/issue-358-tc003-cloudfront-api`
- 起点: `948832c3`（PR #374 final head）
- implementation commit: `192f37dd`
- PR: `https://github.com/tsuji-tomonori/rag-assist/pull/376`（draft）

## 受けた指示

TC-003段階2としてCloudFront `/api/*` routingを実装する。`origins.RestApiOrigin`、cache disabled、`AllViewerExceptHostHeader`、all methods、`/api` prefix stripを固定し、Authorization / Cookie / query / Last-Event-IDをoriginへ転送する。現行global SPA 403/404 fallbackがAPI errorを200の`index.html`へ変換しないよう、SPA fallbackをdefault behavior専用viewer-request rewriteへ移す。SPA runtime config切替は別PRに維持する。

特に、API 403/404がSPA HTML/200へrewriteされないnegative assertion、`api` exactと`api/*`の両behavior、missing static assetの扱いを重視するよう指示された。

## 要件整理

- `AC-TC003-004`: `/api/v1/health`をoriginの`/v1/health`へ転送する。
- `AC-TC003-006`: API behaviorのCloudFront cacheを無効化する。
- `AC-TC003-007`: viewerの`Host`をREST API originへ転送しない。
- API root `/api`もSPA fallbackへ落とさずREST rootへ転送する。
- APIの401/403/404/5xx status/bodyをSPA HTMLまたはHTTP 200へ変換しない。
- 認証・認可、tenant/resource boundary、RAG safety、SPA接続先は変更しない。

## 検討・判断

1. `api/*`だけでは`/api` exactがdefault behaviorへ落ちるため、`api`と`api/*`を同一API behavior設定で登録した。
2. `RestApiOrigin`にREST API constructを渡し、deployment stage `prod`のorigin path生成をCDKへ委ねた。
3. AWS managed `CachingDisabled`と`AllViewerExceptHostHeader`を使用した。後者はviewer `Host`を除外しつつAuthorization、Last-Event-IDを含むviewer header、Cookie、全query stringを転送する。
4. Distribution-level custom error responseはorigin種別を区別しないため撤去した。SPA client route fallbackはdefault S3 behaviorだけのviewer-request Functionへ移した。
5. SPA Functionは最終path segmentに拡張子がないURIだけを`/index.html`へrewriteする。`/assets/missing.js`のような拡張子付きmissing assetはorigin 403/404を保持する。拡張子なしstatic objectは将来の専用behaviorまたは除外規則が必要と文書化した。
6. 段階3のSPA `apiBaseUrl`相対path切替、WebSocket、Hosted UI + PKCE、direct origin制限を明確に対象外とした。

## 実施作業

- `infra/lib/memorag-mvp-stack.ts`
  - SPA route rewrite CloudFront Functionを追加。
  - API prefix strip CloudFront Functionを追加。
  - `RestApiOrigin`、`api` / `api/*` ordered behaviorを追加。
  - all methods、cache disabled、`AllViewerExceptHostHeader`を設定。
  - global 403/404 custom error responseを撤去。
- `infra/test/memorag-mvp-stack.test.ts`
  - synthesized Function codeを実行し、exact/nested prefix、SPA route、missing assetのURI結果を検証。
  - behavior、managed policy IDs、origin stage、Function associationを検証。
  - `CustomErrorResponses`不存在とAPI behaviorにSPA Functionがないnegative invariantを検証。
- CDK snapshotと`docs/generated/infra-*`を再生成。
- `ARC_ADR_005`、`DES_HLD_002`へ段階2の実装契約、error分離、missing asset、未実装境界を追記。
- task md、draft PR、日本語受け入れ条件コメント、セルフレビューを作成。

## 成果物

- implementation commit: `192f37dd`
- draft PR: `https://github.com/tsuji-tomonori/rag-assist/pull/376`
- 受け入れ条件コメント: `https://github.com/tsuji-tomonori/rag-assist/pull/376#issuecomment-4992843066`
- セルフレビュー: `https://github.com/tsuji-tomonori/rag-assist/pull/376#issuecomment-4992847712`
- task: `tasks/done/20260716-2233-issue-358-tc003-cloudfront-api.md`

## 検証結果

### 成功

- `npm test -w @memorag-mvp/infra`: 41/41 pass。
- root lint: pass。
- `npm run typecheck -w @memorag-mvp/infra`: pass。
- `npm run build -w @memorag-mvp/infra`: pass。
- `npm run docs:infra-inventory:check`: pass。
- `npm run docs:hidden-unicode:check`: pass。
- `python3 scripts/validate_docs.py`: pass。
- `git diff --check`: pass。
- GitHub Actions run `29504313501`: success。API/Web coverage、infra/benchmark test、全build、CDK synth + cdk-nag、GSI guardを確認。promotion gateは想定どおりskip。
- semver label run `29504874578`: `semver:minor` 1件でsuccess。

### Blocked / 中断

- local root `npm run ci`はsandboxがtsx CLIのIPC Unix socket `/tmp/tsx-1000/*.pipe` とAPI test用loopback serverのlistenを`EPERM`で拒否した。contract / benchmark launcherとserver起動系API testsが環境要因で失敗し、Web 442件とinfra testsは成功した。
- sandbox外root CIの未承認実行は中断され、完了または成功として扱っていない。full CI判定はGitHub Actions run `29504313501`の実結果を使用した。

## GitHub Apps / fallback記録

- PR作成: GitHub Apps callが243秒応答せず中断。`gh pr list`で未作成を確認してから`gh pr create --draft`へfallbackした。
- PR本文更新: GitHub Appsで成功した。
- semver変更: GitHub Appsで`semver:minor`追加は成功したが、`semver:patch`削除が300秒超応答せず中断。`gh pr edit --remove-label`へfallbackし、minor 1件とsemver rerun successを確認した。
- top-level comment: GitHub Apps callが60秒でtimeoutし、未作成を確認してから`gh pr comment`へfallbackした。

## 指示へのfit評価

- exact `api`と`api/*`、prefix strip、`RestApiOrigin`、all methods、cache disabled、Host除外と認証情報転送を実装・assertion化したためfit。
- API errorをSPA HTML/200へ変換しないnegative invariantをglobal custom error不存在とFunction association分離の両面で固定したためfit。
- missing static assetと拡張子なしstatic objectの制約をHLD/ADRとテストへ反映したためfit。
- SPA config、WebSocket、Hosted UI、direct originを変更せず、段階移行境界を維持したためfit。
- GitHub Appsを優先し、hang時だけ未実行状態を確認して`gh` fallbackを使い、理由を記録したためworkflowへfit。

## 未対応・制約・リスク

- 実AWSのCloudFront→API Gateway疎通は未実施。段階3切替前にpreview環境で認証、SSE、large payload、API error status/bodyを確認する。
- API Gateway execute-api URLはまだ到達可能で、SPA `config.json`もdirect REST URLを保持する。段階3以降で切替・制限する。
- `/ws/*`、WebSocket ticket、Hosted UI + PKCE、security response headers、direct origin制限は後続。TC-003全体は未完了。
- stacked merge順 `#365 → #369 → #374 → #376` がblocker。
- final-head GitHub CIはtask/report完了commitをpush後に監視し、結果をPR commentへ追記する。
- merge、deploy、releaseは未実施。
