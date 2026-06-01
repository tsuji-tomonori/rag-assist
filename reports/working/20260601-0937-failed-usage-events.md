# 作業完了レポート: failed UsageEvent 補強

## 受けた指示

- `.workspace/plan-060101.txt` の継続として、UsageEvent / admin usage / cost audit 実装の完了条件に対する不足を確認し、実装・検証まで進める。

## 要件整理

- UsageEvent 型は `status: "succeeded" | "failed"` と `errorCode` を持つ。
- provider 呼び出しが失敗した場合も、利用試行を監査可能な UsageEvent として残す。
- 失敗は呼び出し元へ隠さず再 throw する。

## 検討・判断

- async agent / benchmark / debug では failed / missing UsageEvent を残す経路があった。
- しかし `UsageTrackingTextModel` の generate / embed は inner provider が throw した場合に UsageEvent を保存していなかった。
- provider usage が得られない失敗でも、prompt / input text から推定できる token は `tokenizer_estimate` として保存する方が、監査と異常利用検知に有用と判断した。

## 実施作業

- `UsageTrackingTextModel.generate()` / `embed()` を try/catch 化した。
- 失敗時も `status: "failed"`、`errorCode`、token 推定、idempotencyKey を持つ UsageEvent を `putOnce` してから元 error を再 throw するようにした。
- failed generate / failed embedding の unit test を追加した。

## 成果物

- provider 失敗時の UsageEvent 監査 contract を実装。
- 失敗時も既存 idempotencyKey で重複保存を抑止する経路を維持。

## 検証

- `npm run typecheck -w @memorag-mvp/api`: pass
- `./node_modules/.bin/tsx --test apps/api/src/rag/usage-tracking-text-model.test.ts apps/api/src/rag/pricing-catalog.test.ts`: pass（11 件）
- `git diff --check`: pass

## Fit 評価

- `.workspace/plan-060101.txt` の UsageEvent を一次データにする方針に沿い、成功だけでなく失敗した LLM / embedding 利用試行も監査可能にした。
- 実 provider の失敗内容や実 token usage はローカル unit では検証していないため、実 AWS 検証は未完了として残した。

## 未対応・制約・リスク

- 実 AWS Bedrock / DynamoDB での provider usage 永続化は未検証。
- 実 S3 への admin export 保存と署名付き URL の動作は未検証。
- PR 作成、PR コメント、task md の `tasks/done/` 移動は未実施。
- 現在の作業は既存 dirty worktree 上で継続しており、origin/main からの専用 worktree 作成フローは未完了。
