# PR #357 Usage / Cost CI 収束 作業レポート

## 受けた指示

CI 成功後の PR #353 以降を順次確認し、条件を満たした PR を `main` へマージする。#356 マージ後、#357 を最新 `main` へ収束して検証・修復する。

## 要件整理・判断

- stacked base の差分を最新 `main` へ収束し、PR base を `main` に変更する。
- Usage / Cost の tenant-scoped event、versioned pricing、read と分離した export 認可、unknown / missing / completeness を維持する。
- #356 までの Access / Audit、server capability、mutation evidence を競合解消で失わない。
- live AWS/provider/billing acceptance は自動検証へ読み替えず、production `active` 化の release blocker として維持する。

## 検討・実施作業

- `origin/main` を merge し、chat E2E、admin component/hook test、Web trace/inventory の競合を双方の contract を残して解消した。
- 完了済み Usage / Cost task を `gapTasks` から除外し、Web inventory を再生成した。
- #355 由来の `AdminPanels.test.tsx` が旧 Usage/Cost 配列 shape を前提としていたため、現行の event page、completeness、priced cost item fixture と期待状態へ修復した。
- chat temporary scope E2E は #356 で検証済みの exact accessible name と new-conversation contract を採用した。
- README、deploy 手順、正規 REQ/DES/OPS は元 PR で同期済みで、今回の変更は統合 test と生成 trace の収束に限定されるため追加更新不要と判断した。

## 成果物

- `apps/web/src/features/admin/components/AdminPanels.test.tsx`
- `apps/web/src/features/admin/components/AdminWorkspace.test.tsx`
- `apps/web/src/features/admin/hooks/useAdminData.test.ts`
- `apps/web/e2e/chat-document-flow.spec.ts`
- 更新済み Web inventory と本 task / report

## 検証結果

- admin target: 3 files / 45 tests 成功。
- Web full coverage: 61 files / 442 tests 成功。Statements 90.80%、Branches 85.72%、Functions 90.66%、Lines 93.61%。
- API full coverage: 801 tests 成功。Statements / Lines 90.45%、Branches 80.43%、Functions 92.92%。API branch は既存改善 task の管理対象。
- infra: 38 tests 成功。benchmark: 102 tests 成功。
- `npm run lint`: 成功。
- 全 workspace typecheck / build: 成功。既存の Vite chunk / Lambda bundle size warning のみ。
- `npm run rag:release:source-audit`: 成功。dataset 固有分岐 0、artifact mismatch 0。
- `task docs:check`: 成功。OpenAPI、97 APIs / 582 API documents、Web / infra inventory、hidden Unicode を含む。
- Chromium full E2E: 27 / 27 成功。chat scope、axe、responsive、state recovery、visual、高影響操作を含む。
- `git diff --check`: 成功。

## 指示への fit 評価

統合で検出した旧 fixture shape の失敗を production fallback や coverage threshold 緩和で隠さず、現行 API contract に沿う test へ修復した。Access/Audit と Usage/Cost の認可境界を併存させ、RAG 根拠性を変更せず、benchmark 期待語句・QA sample 固有値・dataset 固有分岐を本番実装へ追加していない。

## 未対応・制約・リスク

- 実 AWS provider usage、実 DynamoDB query、署名付き export storage、approved billing source との live reconciliation は未実施。owner / FinOps の許容差承認と照合成功まで production `active` 化を禁止する。
- representative screen reader、実ブラウザ 200% / 400% zoom、real-device touch / virtual keyboard、Firefox / WebKit は未実施で、manual evidence task の blocker を維持する。
- GitHub Actions MemoRAG CI run `29426634270` と semver 検証は成功した。task lifecycle push 後の run `29427316713` は 801 API tests 中1件が同時刻 event の UUID order を固定視して失敗したため、task を `do` に戻して `feature` 識別の決定的 assertion へ修正した。修正 head の run `29456068666` は API coverage を含む全必須 step が成功し、条件付き RAG promotion gate は設計どおり skip した。
