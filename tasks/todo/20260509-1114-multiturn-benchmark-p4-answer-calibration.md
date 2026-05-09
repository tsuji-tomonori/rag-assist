# Multi-turn benchmark P4 answer / refusal calibration

状態: todo

## 背景

ChatRAG / MTRAG 系では、回答が長すぎると expectedContains は通っても unsupported sentence rate が悪化しやすい。会話履歴由来の情報も、文書 evidence で再確認できた場合だけ回答に使う必要がある。

## 目的

benchmark profile 用の短答・根拠限定 answer policy と refusal calibration を追加し、unsupported sentence と誤回答を減らす。

## スコープ

- benchmark profile 用 answer style policy
- unsupported sentence 検出後の answer repair / 短縮
- citation が期待 page 周辺にない場合の追加検索
- refusal precision / recall の個別集計

## 受け入れ条件

- [ ] 根拠 chunk にない補足説明を抑制する benchmark answer policy がある。
- [ ] unsupported sentence が出た場合に repair path または明示的な failure metric が残る。
- [ ] unanswerable turn の refusal precision / recall が集計できる。
- [ ] 会話履歴だけを根拠にした回答を許さない。

## 検証計画

- answer generation / support verifier unit test
- unanswerable benchmark smoke
- `git diff --check`
