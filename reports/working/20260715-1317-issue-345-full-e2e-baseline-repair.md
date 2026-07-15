# Issue #345 full E2E baseline 修復レポート

## 受けた指示

Issue #345 の全体完了へ向け、最新 stacked head で automated UI / a11y / responsive / visual evidence を実測し、未解決失敗を修復する。新規 PR は増やさず、既存 draft PR #357 へ限定して反映する。

## 要件整理

- chat の質問 textbox を semantic role / exact accessible name で特定する。
- 一時添付を永続文書と誤認せず、新しい会話で検索 scope が失効することを検証する。
- 高影響操作は利用者向け accessible name で操作する。
- 累積 UI 変更と visual baseline を同期し、目視未確認の snapshot を機械的に承認しない。
- smoke だけでなく full Chromium E2E 全件を成功させる。

## 検討・判断

- 旧 `資料削除で再質問時の挙動が変わる` test は chat attachment を永続文書一覧から削除できる前提だった。しかし production contract は chat attachment を temporary scope に隔離し、永続一覧へ混入させない。削除操作自体は `E2E-UI-RISK-001` で別途検証済みのため、本 test は new conversation 後に temporary scope が消える契約へ修正した。
- `getByLabel('質問')` は form / textbox / submit button の部分一致で曖昧になったため、textbox role と exact accessible name を使用した。
- 用語展開の公開操作は可視文言 `公開` ではなく、現在の accessible name `承認済み用語展開を公開` を正本にした。
- debug snapshot は回答状態ヘッダー、admin snapshot は用語展開タブの追加差分を expected / actual / diff で目視確認してから対象2枚だけ更新した。

## 実施作業

- chat document flow の locator と temporary attachment lifecycle test を修正した。
- risky-operation test の公開ボタン locator を semantic contract に同期した。
- debug panel / admin workspace の Chromium visual snapshot を再生成した。
- smoke と full E2E を実行し、検出した5件の failure を全て修復した。

## 成果物

- `apps/web/e2e/chat-document-flow.spec.ts`
- `apps/web/e2e/visual-regression.spec.ts`
- debug / admin Chromium snapshot 2枚
- task: `tasks/done/20260713-2304-responsive-chat-ui-verification.md`

## 検証結果

- `npm run test:e2e:smoke -w @memorag-mvp/web`: 15 / 15 成功。
- 初回 `npm run test:e2e:all -w @memorag-mvp/web`: 22 / 27 成功、5 failure を検出。
- 対象修復 test: 成功。
- 最終 `npm run test:e2e:all -w @memorag-mvp/web`: 27 / 27 成功。
- `npm run lint`: 成功。
- `npm run typecheck -w @memorag-mvp/web`: 成功。
- `task docs:check`: 成功。UI trace / generated Web inventory freshness を含む。
- PR #357 の最新 MemoRAG CI run `29388912549`: 成功。lint、typecheck、docs contract、generated inventory、infra/API/Web/benchmark test と coverage、全 build、CDK synth / cdk-nag、DynamoDB GSI guard、artifact upload を完走した。

## stacked PR lifecycle 監査

- PR #348〜#354 は最新表示上 draft のまま。MemoRAG CI は成功している。
- PR #355 は draft で MemoRAG CI run `29378658521` が失敗している。`view:admin` の task trace が移動前の `tasks/do/20260714-1011-admin-ui-governance-quality.md` を参照し、Web branch coverage は 82.84% で 85% gate を未達だった。
- PR #356 は draft で MemoRAG CI run `29381567079` が失敗している。generated Web inventory の task trace 不整合と Web coverage gate 未達が残る。
- PR #357 は draft かつ PR #356 を base としており、最新 CI は成功した。ただし下位 PR の失敗、未 merge、手動 evidence 未取得のため Issue #345 の完了条件は未達である。
- CI 修復は `gh-fix-ci` workflow の明示承認後、merge は不可逆操作の明示確認後に行う。いずれも未承認のため実施していない。

## 指示への fit 評価

自動化された chat、mobile navigation、state recovery、axe、visual、high-impact operation の baseline を最新 stack head で復旧した。temporary attachment を production の永続文書として見せる mock / fallback は追加していない。API authorization、RAG の根拠性、tenant boundary は変更していない。

## 未対応・制約・リスク

- representative screen reader、実 browser 200% / 400% zoom、real-device touch / virtual keyboard は未実施であり、manual evidence task の release blocker を維持する。
- Playwright project は Chromium desktop 1件のままで、PR required gate / mobile project / Firefox / WebKit は automated quality gate task の残余である。
- PR #355 / #356 の CI 修復、stack の main 収束、PR required UI quality gate の導入は未完了である。
- production deploy、merge、release は実施していない。
