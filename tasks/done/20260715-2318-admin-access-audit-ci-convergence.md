# PR #356 Access / Audit CI 収束

- 状態: done
- 優先度: P0
- 種別: CI 修復 / stacked PR 収束 / E2E 証跡
- 起票日: 2026-07-15
- 対象 PR: #356

## 作業前チェックリスト

- [x] #355 を含む最新 `origin/main` へ収束する。
- [x] 既存 CI の失敗ステップと閾値をログから特定する。
- [x] completed task を partial view の未完了 trace に残さない。
- [x] 閾値を緩和せず、不足する admin 分岐テストを追加する。
- [x] E2E/visual の先行 UI 変更に対する stale evidence を目視して修復する。

## 受け入れ条件

- [x] Web branch coverage が 85% 以上である。
- [x] generated Web inventory と semantic trace が最新である。
- [x] API/Web の対象・full test、lint、typecheck、build、docs check が成功する。
- [x] Access/Audit の認可・tenant・audit/export 境界を弱めない。
- [x] Playwright の失敗を原因別に修復し、各失敗シナリオの再実行が成功する。
- [x] 日本語の受け入れ確認・セルフレビューを PR へ記録し、この task を `done` へ移動する。

## Done 条件

- [x] `main` 収束後の差分と検証結果が作業レポートへ記録される。
- [x] 修復差分が目的別 commit として push される。
- [x] PR #356 の CI run `29423211072` が成功し、`MERGEABLE` を確認する。
- [x] PR コメント完了後に状態を done とし `tasks/done/` へ移動する。
