# 作業完了レポート

保存先: `reports/working/20260505-0052-benchmark-search-dataset-user-acl.md`

## 1. 受けた指示

- review で指摘された search benchmark dataset の `user` が実行時に使われていない問題に対応する。
- 通常利用者向け `/search` には影響させず、runner 専用 `/benchmark/search` で ACL 評価用の利用者文脈を扱う。
- RBAC と benchmark 評価結果の整合性を test / docs で保証する。

## 2. 要件整理

| 要件ID | 指示・要件 | 重要度 | 対応状況 |
|---|---|---:|---|
| R1 | search benchmark dataset の `user.groups` を ACL 評価に使う | 高 | 対応 |
| R2 | 通常 `/search` の認証主体を payload で上書きできない状態を維持する | 高 | 対応 |
| R3 | dataset payload から `SYSTEM_ADMIN` などの特権 group を指定できないようにする | 高 | 対応 |
| R4 | runner 用 endpoint の contract test で ACL positive / negative を検証する | 高 | 対応 |
| R5 | docs と実装を同期する | 高 | 対応 |

## 3. 検討・判断したこと

- `SearchRequestSchema` は通常 `/search` と共有されているため、通常 API に `user` を追加せず、`BenchmarkSearchRequestSchema` を新設した。
- `/benchmark/search` だけが任意の `user` を受け取り、`service.search()` へ渡す `AppUser` を dataset subject として合成する構成にした。
- `user` override は `BENCHMARK_RUNNER` service user からの呼び出し時だけ許可し、`SYSTEM_ADMIN` からの subject override は拒否する方針にした。
- dataset user の group には `SYSTEM_ADMIN`、`RAG_GROUP_MANAGER`、`BENCHMARK_RUNNER`、`ANSWER_EDITOR`、`USER_ADMIN`、`ACCESS_ADMIN`、`COST_AUDITOR` を指定できないようにした。

## 4. 実施した作業

- `BenchmarkSearchRequestSchema` を追加し、benchmark search 専用の `user` payload と特権 group 拒否を定義した。
- `/benchmark/search` handler で request body の `user` を ACL 評価用 `AppUser` に変換し、通常 `/search` は変更しなかった。
- `benchmark/search-run.ts` が dataset row の `user` を `/benchmark/search` に送るようにした。
- contract test で `GROUP_A` は ACL 付き文書を検索でき、`GROUP_B` は検索できないことを endpoint 経由で検証した。
- contract test で `SYSTEM_ADMIN` 呼び出し時の `user` override は 403、payload の `SYSTEM_ADMIN` group は 400 になることを検証した。
- README、API examples、API design、NFR docs を更新した。

## 5. 成果物

| 成果物 | 形式 | 内容 | 指示との対応 |
|---|---|---|---|
| `memorag-bedrock-mvp/apps/api/src/schemas.ts` | TypeScript | `BenchmarkSearchRequestSchema` と特権 group 拒否 | dataset user 入力 |
| `memorag-bedrock-mvp/apps/api/src/app.ts` | TypeScript | `/benchmark/search` の dataset user ACL 文脈適用 | 実行時修正 |
| `memorag-bedrock-mvp/benchmark/search-run.ts` | TypeScript | search dataset row の `user` を API に送信 | runner 修正 |
| `memorag-bedrock-mvp/apps/api/src/contract/api-contract.test.ts` | Test | ACL positive / negative と override 拒否を検証 | 回帰防止 |
| `memorag-bedrock-mvp/README.md`、`memorag-bedrock-mvp/docs/` | Markdown | 運用・API・要件 docs を同期 | docs 差分解消 |

## 6. 検証

| コマンド | 結果 | メモ |
|---|---|---|
| `npm --prefix memorag-bedrock-mvp run test -w @memorag-mvp/api` | pass | 86 tests。途中 1 回 SSE endpoint の既存 contract が 500 を返したが、再実行では全件 pass |
| `npm --prefix memorag-bedrock-mvp run typecheck -w @memorag-mvp/benchmark` | pass | search runner typecheck |
| `task memorag:verify` | pass | lint、workspace typecheck、build |
| `git diff --check` | pass | whitespace check |

## 7. 指示へのfit評価

| 評価軸 | 評価 | 理由 |
|---|---:|---|
| 指示網羅性 | 5/5 | 指摘された dataset user 未使用と ACL 評価ずれを解消した |
| 制約遵守 | 5/5 | 通常 `/search` には `user` override を追加していない |
| 成果物品質 | 5/5 | endpoint 経由の ACL positive / negative と特権 override 拒否を検証した |
| 説明責任 | 5/5 | セキュリティ判断と検証結果を report / docs に残した |
| 検収容易性 | 5/5 | 変更箇所と確認コマンドを明記した |

**総合fit: 5.0/5（約100%）**

理由: search benchmark の ACL 評価が dataset user 文脈で動くようになり、通常検索 API の境界と runner endpoint の最小権限を維持した。

## 8. 未対応・制約・リスク

- 未対応: なし。
- 制約: 実 AWS CodeBuild 実行は未実施。ローカル contract test と build/typecheck で代替した。
- リスク: 既存 search benchmark dataset が `SYSTEM_ADMIN` などの特権 group を指定している場合は 400 になるため、dataset 側は評価対象の ACL group 名を使う必要がある。
