# API コード対応ドキュメント生成 詳細設計

- ファイル: `docs/3_設計_DES/11_詳細設計_DLD/DES_DLD_011.md`
- 種別: `DES_DLD`
- 作成日: 2026-07-13
- 状態: Draft

## 何を書く場所か

runtime OpenAPI、TypeScript API 実装、既存テストを解析し、API ごとの詳細設計、IF、メッセージ、query、sequence、unit test 文書を生成する仕組みを定義する。

## 対象

- 生成器: `apps/api/src/generate-api-code-docs.ts`
- 静的解析: `apps/api/src/api-code-docs/analyzer.ts`
- 中間表現: `apps/api/src/api-code-docs/model.ts`
- Markdown renderer: `apps/api/src/api-code-docs/render.ts`
- 生成先: `docs/generated/api-code/`
- 実行コマンド: `npm run docs:api-code`、`npm run docs:api-code:check`

API の runtime behavior は変更しない。生成専用 annotation、decorator、コメント、定数、設定表を route、handler、service、store へ追加せず、既存の実装コードとテストだけを解析入力にする。

## 参照実装 lazunex から横展開する原理

`.workspace/lazunex` の実装は、単一の手書き仕様や文書用 metadata を全生成物へ複製する方式ではない。一次情報ごとに解析器を分け、共通の API 識別子とコード位置で対応付け、目的別 Markdown へ決定的に投影する。

| lazunex の一次情報・生成器 | 抽出した原理 | rag-assist での適用 |
| --- | --- | --- |
| `generate_openapi_if_specs.py` | runtime OpenAPI を IF の正とする | `loadRuntimeOpenApiDocument()` の結果を `if_gen.md` へ再利用する |
| `generate_api_detail_design.py` | route、関数、schema、SQL、値の由来をコード位置付きで統合する | route handler、到達 symbol、主処理、分岐、store/external call を統合する |
| `generate_query_specs.py` | SQL/DDL を query の一次情報として解析する | SQL を持たない構成のため、実際の store/object/vector/external port call を論理 query とする |
| `generate_api_sequences.py` | handler と依存 call の順序を静的解析する | handler 起点の call graph を Auth、Validation、Service、Store、External、Response に分類する |
| `generate_api_message_catalog.py` | response、例外、log の literal を AST から収集する | OpenAPI response description と実装 literal を区別して収集する |
| `generate_api_unit_test_factors.py` | 分岐・例外から test factor を作る | handler と直下関数の分岐を API 単位の test factor とし、既存 `.test.ts` との対応を併記する |
| registry / runner / CLI の check mode | generator の登録、決定的出力、再生成差分を gate にする | npm / Taskfile / CI に生成と exact file-set freshness check を置く |

rag-assist では TypeScript compiler API の AST と type checker を使う。lazunex の Python/FastAPI/SQL 固有規約はコピーせず、「実行契約とコードを一次情報にする」「目的別の独立投影」「根拠位置を残す」「決定的再生成を検査する」という原理を横展開する。

## 入出力

### 入力

| 入力 | 用途 | 確度 |
| --- | --- | --- |
| runtime `GET /openapi.json` 相当の document | method/path、summary、description、request/response schema、認可、lifecycle | contract として確定 |
| `apps/api/src/app.ts` と `apps/api/src/routes/**/*.ts` | route 登録、handler、コード専用 route | 実装として確定 |
| handler から解決できる `apps/api/src/**/*.ts` の symbol | service、helper、store、external call、分岐、message | 静的に到達できる範囲で確定 |
| `apps/api/src/**/*.test.ts` | request path と直下 service/data/external symbol に対応する既存 test | 静的対応候補。assertion の充足までは推定しない |

### 出力

API slug は method と path から機械的に作る。例えば `POST /questions/{questionId}/answer` は `post-questions-questionid-answer/` へ出力する。各 directory は次の 6 ファイルを必ず持つ。

| ファイル | 内容 |
| --- | --- |
| `detail-design_gen.md` | API の役割、handler 主処理、主要分岐、到達実装、データ境界、メッセージ、既存 test |
| `if_gen.md` | runtime OpenAPI に基づく header、parameter、body、認可、lifecycle、response。OpenAPI 外 route は実コードから確定できる範囲 |
| `messages_gen.md` | contract description、HTTP response literal、例外、log、SSE/event literal と発生条件 |
| `query_gen.md` | store/object/vector/external port の論理 CRUD・実行操作と caller、コード位置 |
| `sequence_gen.md` | Mermaid sequence、主要 call 順序、handler・直下関数の分岐 |
| `unit-test_gen.md` | 既存 test の静的対応、API 固有分岐の test factor、未実装を含むコード由来 test case 候補 |

上位の `index.md` は全 API と 6 文書へのリンクを持つ。`manifest.json` は operation、slug、source location、解析件数を機械可読に記録する。

## 処理手順

1. Hono app から runtime OpenAPI document を生成し、既存の OpenAPI 品質補完を適用する。
2. API package の `tsconfig.json` から TypeScript `Program` と `TypeChecker` を作る。
3. `app.openapi(...)` と `app.get/post/.../all(...)` を探索し、route config、method、path、handler symbol を解決する。
4. runtime OpenAPI の各 operation に対応する source route が一件だけ存在することを検査する。
5. handler を起点に repository 内 symbol の到達 graph を cycle guard 付きで走査する。
6. handler flow、function、call、branch、message、data access、related test を共通中間表現へ格納する。
7. 中間表現を API ごとの 6 Markdown と index/manifest へ決定的に render する。
8. 通常実行では生成 directory を置換する。`--check` では期待ファイルの欠落・内容差分・余剰 stale file をすべて列挙し、差分があれば失敗する。

## 可読性と網羅性の境界

解析器は深い共通 helper を含む到達 graph と全 store/external boundary を収集する。一方、API ごとの詳細設計と unit test に全 helper の内部分岐を重複展開すると、API 固有仕様と共通実装の区別が失われる。このため投影時に次を適用する。

- handler 主処理は source statement 順で全件を記載する。
- 詳細設計の主要 symbol は handler から深さ 2 までを記載する。
- API 分岐と test factor は handler と直下関数の深さ 1 までを記載する。
- store/external boundary は深さにかかわらず `detail-design_gen.md` と `query_gen.md` に記載する。
- sequence は handler の主要 call と、深い層を含む store/external boundary を記載し、汎用 utility call は省く。
- 省略規則は全 API 共通の renderer policy であり、API 別 metadata ではない。

## エラー処理

- runtime OpenAPI operation に対応する source handler を解決できない場合は生成を失敗させる。
- 同一 method/path の route を複数検出した場合は生成を失敗させる。
- handler expression を関数宣言または関数値へ解決できない場合は生成を失敗させる。
- OpenAPI に未登録のコード専用 route は除外せず、warning と解析限界を明記した 6 文書を生成する。
- interface/dynamic dispatch の実装先を一意に解決できない場合は、確認できた logical call だけを記載し、adapter 実装を推測しない。
- message が動的文字列で確定できない場合は、架空の文面を補わない。
- test 対応は静的候補と明記し、test が存在することを branch coverage 済みという意味にしない。

## 鮮度検証と CI

```bash
npm run docs:api-code
npm run docs:api-code:check
```

同じコマンドは `task docs:api-code` と `task docs:api-code:check` からも実行できる。`.github/workflows/memorag-ci.yml` は freshness check を必須検証として実行する。`.github/workflows/memorag-openapi-docs.yml` は OpenAPI Markdown とコード対応文書を再生成し、差分があれば更新 PR を作る。

`--check` は既存ファイルだけを比較するのではなく、現在の route set から期待 path 集合を再計算する。API 削除後に残った directory も stale file として失敗させる。

## テスト観点

- runtime OpenAPI の全 operation とコード専用 route が source から検出される。
- 全 operation に 6 文書があり、slug と出力 path が一意である。
- 複雑な問い合わせ回答 API で contract、認可、service、store、message、sequence、既存 route test が対応する。
- SSE API の複数 store access が query 文書へ対応する。
- 同一中間表現の再 render が byte-for-byte で一致する。
- freshness check が missing、changed、stale file をそれぞれ検出する。
- production route/app/service に生成専用 metadata が存在しない。

## 既知の制約

- computed property、動的 factory、runtime-only dispatch など、TypeScript checker が一意に解決できない経路は完全には復元できない。
- query 文書は logical store/external operation の仕様であり、DynamoDB expression、S3 request、SQL の物理実行計画を意味しない。
- sequence は静的な call/dependency 順序であり、非同期 worker、eventual consistency、並列実行の wall-clock 順序を保証しない。
- 既存 test の対応付けは literal request path と直下の意味ある symbol 参照に限定し、間接 fixture や動的 path builder は未検出になり得る。
- source line はコード変更で移動するため、生成物を手編集せず必ず再生成する。

## セキュリティと情報境界

生成処理は build-time の read-only 解析であり、認証・認可判定や runtime store を変更しない。出力には repository 内 source path、公開 contract、実装上の論理 store 名、実コードに存在する message literal が含まれるため、公開範囲は repository と同じとし、token、環境変数値、実データ、署名付き URL は入力・出力しない。
