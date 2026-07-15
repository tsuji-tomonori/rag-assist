# PR #356 Access / Audit CI 収束 作業レポート

## 受けた指示

CI 成功済みの PR #353 以降を順次確認し、条件を満たした PR をマージしていく。#355 マージ後、#356 を最新 `main` へ収束して検証・修復する。

## 要件整理・判断

- stacked base の差分を最新 `main` へ収束し、base を `main` に変更する。
- CI 失敗は閾値緩和で回避せず、追加実装の未検証分岐をテストで補う。
- partial view の `gapTasks` は未完了 task のみを参照し、完了済み task を残さない。
- E2E は先行 PR の UI 意味変更を尊重し、曖昧 locator と stale visual baseline だけを修復する。

## 実施作業

- #355 を含む `origin/main` を取り込み、admin test と generated inventory の競合を双方の意図を保持して解消した。
- completed access-audit task を admin partial view の gap trace から除外し、Web inventory を再生成した。
- admin user query/pagination、audit export capability、mutation evidence、server capability blocker、projection reconciliation の分岐テストを追加した。
- chat の曖昧な質問 locator、alias 公開操作名、invalid-route status locator を現行 accessible name に同期した。
- 一時 chat 添付を永続文書一覧から削除しようとしていた矛盾した E2E を、会話切替で旧 temporary scope を検索対象外にする現行仕様へ修正した。
- debug panel actual を目視し、journey header 追加が意図どおりであることを確認して当該 baseline のみ更新した。

## 成果物

- admin Access/Audit の追加 Web tests
- Web trace/inventory の完了 task 参照修復
- Playwright locator・temporary attachment scenario・debug visual baseline の収束修正
- 本 task と作業レポート

## 指示への fit 評価

CI が示した Web branch coverage と generated inventory の 2 失敗を直接修復した。認可は server capability の表示に留め、API の最終認可、tenant partition、audit export permission/redaction を弱めていない。benchmark 期待語句、QA sample 固有値、dataset 固有分岐は追加していない。

README/deploy/runbook は公開設定・運用コマンドに変更がないため更新不要と判断した。正規 FR/API/data/UI design は元 PR で同期済みで、今回の追加は検証・generated trace の収束に限定される。

## 検証

- Web full coverage: 54 files / 409 tests 成功、statements 90.70%、branches 85.09%、functions 90.81%、lines 93.56%
- admin target: 3 files / 36 tests 成功
- API full coverage: 785 tests 成功、statements/lines 90.39%、branches 80.31%、functions 92.88%
- `npm run lint`: 成功
- `npm run typecheck`: 成功
- `npm run build`: 成功（既存の Vite/infra bundle size warning のみ）
- `task docs:check`: 成功（96 APIs / 576 API documents、Web/infra inventory、hidden Unicode を含む）
- Chromium 全体実行: 初回 23/27、修復後 26/27。残った timing-dependent strict locator は単独再実行で成功し、初回の各失敗も修正後に成功を確認した。
- debug visual baseline: expected/actual/diff を目視後、対象 1 件のみ更新し単独 test 成功

## 未対応・制約・リスク

- 実機 screen reader、実ブラウザ 400% zoom、実デバイス操作は環境がないため未実施であり、達成済みとは扱わない。
- S3 署名付き export artifact の実接続成功経路はローカル未確認。全ページ traversal、redaction、失敗監査は自動 test 済み。
- API branch coverage 80.31% は既存の `tasks/todo/20260712-coverage-api-c1-recovery.md` で追跡中。
- Chromium 最終全体実行は 26/27 で、最後の 1 件は locator 修正後の単独再実行成功による確認。CI merge gate は別途 GitHub Actions で確認する。
