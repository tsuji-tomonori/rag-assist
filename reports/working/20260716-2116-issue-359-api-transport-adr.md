# Issue #359 Phase 3c API transport ADR 作業レポート

保存先: `reports/working/20260716-2116-issue-359-api-transport-adr.md`

## 1. 受けた指示

- `origin/main` (`e12abb07`) 起点の専用worktreeでAPI transportを実ソースから棚卸しする。
- 「chat以外REST」「oRPC維持」「境界別併存」を比較し、根拠付きADRとして1案を決定する。
- REST helper、oRPC、SSE/OpenAPI、認証、error、type contract、testability、bundle、routes/workers、benchmark/release auditを対象にする。
- 挙動、公開contract、code、generated historyを変更せず、migration境界・順序・rollback・guard・検証を正規docsへ定義する。
- `confirmed`、`inferred`、`conflict`、`open_question`を区別し、未確定を決定済みにしない。
- benchmark path、FR-089/CORS、Web shim/UI、PR #338 changed paths、generated docsを変更しない。

## 2. 要件整理

| 要件ID | 要件 | 対応 |
| --- | --- | --- |
| R1 | 全transport境界を実ソースから棚卸し | ADRの事実表・inventoryで対応 |
| R2 | 3案比較とdecision | 「境界別併存」をAcceptedとして対応 |
| R3 | migration/rollback/guard | operation単位のpolicyとgateで対応 |
| R4 | 不確実性の区別 | 4分類を明示し、全面移行をopen questionに保持 |
| R5 | 挙動・code・generated非変更 | task/ADR/reportだけを変更 |
| R6 | PR #338等の禁止scope | GitHub Appsでchanged filenamesを取得し、diff非変更を確認 |

## 3. 調査結果と判断

- API providerはOpenAPIHonoの95 operation、oRPCの5 procedure、chat/ingestのSSEを併存する。
- 公開contractのruntime sourceは `GET /openapi.json` であり、authorization/lifecycle metadata、generated freshness、oRPC対応route driftを検証する。
- Webは19 production moduleからREST helperを参照し、chatのJSON unaryだけoRPCを使う。SSEは認証headerと `Last-Event-ID` を持つ直接 `fetch` である。
- benchmarkはquery/searchをoRPCで使うが、seed、artifact、agent runはRESTであり、transport全面統一状態ではない。
- RESTはJSON/text/blob/DELETE body/presigned uploadを扱い、oRPCはJSON unaryの型共有に適する。workerは別Lambda entrypointで、HTTPではなくrun/event/artifact contractを持つ。
- 公開互換とprotocol固有境界を保ちながら既存typed clientの便益を残せるため、「境界別併存」を選んだ。
- oRPC全面拡張と撤去はbundle、latency、consumer、streamingの計測がなく、現時点では決定しない。

## 4. 実施作業

- task mdにRCA、参照inventory、受け入れ条件、Done条件をmain deliverable前に作成した。
- Web/API/benchmark/contract/infra/docs/testをsource-backedで調査した。
- GitHub AppsでPR #338のchanged filenamesを確認し、変更禁止pathをscope boundaryへ記録した。
- `ARC_ADR_006.md` に現行inventory、3案比較、decision、migration順序、rollback、guard、見直し条件を記載した。
- Mermaidで現行transport境界とmigration/rollback flowを可視化した。

## 5. 成果物

| 成果物 | 内容 |
| --- | --- |
| `docs/2_アーキテクチャ_ARC/21_重要決定_ADR/ARC_ADR_006.md` | API transport境界別併存のAccepted ADR |
| `tasks/do/20260716-2109-issue-359-api-transport-adr.md` | task、RCA、AC、調査・検証記録 |
| `reports/working/20260716-2116-issue-359-api-transport-adr.md` | 本作業レポート |

## 6. 検証

### 実行した検証

- `python3 scripts/validate_docs.py`: pass
- `task docs:check`: pass
  - runtime OpenAPI quality/generated freshness
  - API code docs 97 APIs / 582 documents freshness
  - Web trace tests 8/8
  - Web/infra inventory freshness
  - hidden Unicode check
- `git diff --check`: pass（report追加前。最終差分で再実行予定）

### root CIの選定判断

root `npm run ci` は未実施とする。変更はtask、ADR、reportのMarkdownだけで、code、route、schema、公開contract、generated docs、dependency、bundleを変更しない。root CIはこの差分に対して追加のbehavior保証を与えず、repository-defined `task docs:check` とpre-commitが直接の検証となるためである。

## 7. 指示へのfit評価

| 評価軸 | 評価 | 理由 |
| --- | ---: | --- |
| 指示網羅性 | 5/5 | 指定inventory、3案、decision、migration/rollback/guardを含む |
| 制約遵守 | 5/5 | code/public contract/generated/禁止pathを変更していない |
| 成果物品質 | 4.8/5 | source-backed ADRだが将来のbundle/latency計測は未実施 |
| 説明責任 | 5/5 | 事実・推定・衝突・未確定と省略検証を明示 |
| 検収容易性 | 5/5 | path、表、diagram、gate、検証結果を整理 |

**総合fit: 4.9/5（約98%）**

## 8. 未対応・制約・リスク

- 全面移行時期、oRPC streaming、OpenAPI client generation比較、external consumer期限は未確定である。
- dependency準備の `npm install --ignore-scripts` は既存の8 vulnerabilitiesを報告した。dependencyと `package-lock.json` は変更していない。
- code behaviorを変更しないため、runtime smoke、API/Web/benchmark unit test、root CIは実施していない。
- Draft PR #371、`semver:patch` label、受け入れ条件コメント、セルフレビュー、task done移動を完了した。
- GitHub AppsでPR作成・label・受け入れコメントを実施した。受け入れコメントは60秒超で中断したが投稿成功を確認し、以降の操作は`gh` fallbackを使用した。
- merge、deploy、releaseは実施しない。

## 9. PR lifecycle

- Draft PR: https://github.com/tsuji-tomonori/rag-assist/pull/371
- 受け入れ条件確認: https://github.com/tsuji-tomonori/rag-assist/pull/371#issuecomment-4991779015
- セルフレビュー: https://github.com/tsuji-tomonori/rag-assist/pull/371#issuecomment-4991784752
- 初回semver checkはlabel付与前にfailureとなり、`semver:patch`付与後のcheckはsuccessを確認した。
