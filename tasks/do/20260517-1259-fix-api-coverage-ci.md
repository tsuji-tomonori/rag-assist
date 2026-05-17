# API coverage CI failure 修正

状態: do
タスク種別: 修正

## 背景

PR #322 の MemoRAG CI で API test が failure と報告された。Actions log では API test の TAP は 290 件 pass しているが、c8 の branch coverage が 84.98% で閾値 85% に届かず、最後の `Fail when CI checks failed` が workflow を failure にしている。

## 問題文

2026-05-17 の PR #322 CI において、API テストは全件 pass したが、API branch coverage が 84.98% となり、設定閾値 85% を 0.02pt 下回ったため MemoRAG CI が failure になった。

## なぜなぜ分析

### confirmed

- PR #322 の差分は task / report Markdown の追加のみで、API runtime code は変更していない。
- GitHub Actions の API test log は `# pass 290`、`# fail 0` を出している。
- 同 log の coverage summary は `Branches : 84.98% (5355/6301)`。
- c8 は `--branches 85` を要求しているため、0.02pt 未達でも step outcome は failure になる。
- CI comment で coverage が unknown になったのは、coverage step が失敗したため後続の `node -e` output extraction が実行されなかったことによる。

### inferred

- Markdown だけの PR でも、base の API coverage が閾値付近にあると CI gate にかかる。
- 直近の API 実装追加に対して branch coverage の余裕がほぼなくなっている。

### open_question

- どの API file の branch coverage を最小追加テストで最も効率よく改善できるかは、local coverage summary 確認後に決める。

### root cause

API branch coverage が閾値 85% に対してほぼ余裕ゼロの状態で、現在の API test suite では 84.98% に留まっている。

### remediation

API behavior を変えず、既存 code path の未カバー branch を対象に小さな unit test を追加して、branch coverage を 85% 以上に戻す。

## 目的

PR #322 の MemoRAG CI を通すため、API branch coverage を最小限のテスト追加で閾値以上に戻す。

## スコープ

- API tests の追加または調整。
- 必要に応じた作業レポート更新。

## 含まない

- API runtime behavior の変更。
- coverage threshold の引き下げ。
- Markdown task の内容変更。

## 計画

1. worktree の依存関係を整える。
2. CI と同じ API coverage command をローカルで再現する。
3. coverage summary から未カバー branch の多い小さな対象を特定する。
4. 業務ロジックを変えずに API unit test を追加する。
5. API coverage command を再実行し、branch coverage が 85% 以上になることを確認する。
6. `git diff --check` を実行する。
7. report / commit / push / PR comment を更新する。

## ドキュメント保守計画

- runtime behavior や API contract は変えない想定のため、OpenAPI docs 更新は不要。
- テスト追加の理由と CI failure の根拠は作業レポートと PR コメントに残す。

## 受け入れ条件

- [x] API coverage command が pass する。
- [x] API branch coverage が 85% 以上になる。
- [x] 追加テストが benchmark 固有値や固定文言に依存しない。
- [x] API runtime behavior を変更しない。
- [x] `git diff --check` が pass する。
- [ ] PR #322 に CI 修正内容と検証結果をコメントする。

## 検証計画

- `npm exec -w @memorag-mvp/api -- c8 --check-coverage --statements 90 --branches 85 --functions 90 --lines 90 --reporter=text-summary --reporter=json-summary tsx --test src/**/*.test.ts src/**/**/*.test.ts`
- `git diff --check`

## PR レビュー観点

- coverage のために閾値を下げていないこと。
- テスト対象が既存 behavior の有意味な branch であること。
- API runtime、ACL、RAG scope、OpenAPI contract に不要な変更がないこと。

## リスク

- coverage が閾値ぎりぎりだと、今後の小さな実装追加で再び CI が落ちやすい。後続で coverage 余裕を持たせる追加テストも検討する。
