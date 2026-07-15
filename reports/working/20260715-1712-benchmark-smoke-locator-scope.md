# Benchmark smoke locator scope 修復レポート

## 受けた指示

Issue #345 の stacked PR を依存順に確認し、必要な修正と再検証を行って順次 main へマージする。

## 要件整理

- PR #352 を latest main へ収束させる。
- high-impact operation の API 根拠表示を弱体化しない。
- E2E failure を未解決のままマージしない。
- production UI/API/RAG/認可を不要に変更しない。

## 検討・判断

- latest main 統合後の Chromium run は14件中13件が成功し、benchmark start smoke だけが strict mode violation で失敗した。
- 同じ API run ID は履歴 row、operation feedback の対象識別子、結果参照に正当に表示されていた。
- product の重複表示不具合や架空値ではなく、画面全体を探索する test locator が意図した履歴 row より広すぎた。
- assertion を table row の role/accessibility name へ限定し、「起動した run が履歴へ追加された」という postcondition を直接検証した。

## 実施作業

- PR #351 merge 後の latest main を PR #352 branch へ conflict なく統合した。
- benchmark start smoke の exact text locator を created run を含む row locator へ変更した。
- 原因分析、受け入れ条件、検証結果を task/report に記録した。

## 成果物

- `apps/web/e2e/visual-regression.spec.ts`
- `tasks/do/20260715-1711-benchmark-smoke-locator-scope.md`

## 検証結果

- Web coverage: 45 files / 357 tests success。statements 91.81%、branches 85.23%、functions 92.71%、lines 94.69%。
- Web typecheck / build、root lint、semantic UI contract: success。
- API requirements trace + access-control static policy: 2/2 success。
- `task docs:check`: sandbox IPC `EPERM` 後、ユーザー承認の sandbox 外再実行で success。
- 初回 Chromium smoke + risky-operation: 13/14 success。意図した locator failure を検出。
- 修正後対象 Chromium test: 1/1 success。
- 修正後 Chromium smoke 13 + risky-operation E2E/axe 1: 14/14 success。
- `git diff --check`: success。

## 指示への fit 評価

総合 fit: 5.0 / 5.0。API 根拠表示を削って test を通さず、assertion の観測境界を受け入れ契約へ合わせ、対象から broader smoke/security/docs まで再検証した。

## 未対応・制約・リスク

- representative screen reader、200%/400% zoom、real device、Firefox/WebKit、全 feature exhaustive coverage は後続 task の対象。
- production UI/API/RAG/authorization、benchmark期待語句、QA sample/dataset 固有分岐、no-mock 境界は変更していない。
