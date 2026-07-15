# Chat citation smoke locator 修復レポート

## 受けた指示

PR #353 以降も確認し、依存順に main へマージする。

## 要件整理と判断

- PR #354 を latest main へ収束させ、API/Web/security/journey を再検証する。
- Chromium 17件中1件は、`参照元` の部分一致が件数、次操作、citation 見出しの3要素へ一致して失敗した。
- 3表示はいずれも API result/citation 由来の正当な表示で、product 不具合や架空値ではない。
- Citation list 見出しを exact で検証し、受け入れ契約へ test boundary を合わせた。

## 実施作業・成果物

- latest main を PR #354 branch へ conflict なく統合。
- `apps/web/e2e/chat-document-flow.spec.ts` の citation assertion を exact へ限定。
- `tasks/do/20260715-2012-chat-citation-smoke-locator.md` に原因と受け入れ条件を記録。

## 検証結果

- Web coverage: 51 files / 389 tests success。statements 91.99%、branches 85.49%、functions 92.85%、lines 94.79%。
- API coverage: 775 tests success。statements/lines 90.32%、functions 92.77%。branch 80.47% は既存改善 task 管理値。
- 全 workspace typecheck/build、root lint、semantic UI contract、`task docs:check`、`git diff --check`: success。
- 初回 Chromium: 16/17 success。locator ambiguity を検出。
- 修正後対象 Chromium: 1/1 success。
- 修正後 question journey・smoke・visual: 17/17 success。

## 指示への fit 評価

総合 fit: 5.0 / 5.0。正当な journey/citation 表示を削らず、test の観測境界だけを修正し、API/Web 全 suite から E2E/visual まで再検証した。

## 未対応・制約・リスク

- screen reader、200%/400% zoom、real device、Firefox/WebKit は後続横断 task の対象。
- production UI/API/RAG/authorization、benchmark期待語句、QA sample/dataset 固有分岐、no-mock 境界は変更していない。
