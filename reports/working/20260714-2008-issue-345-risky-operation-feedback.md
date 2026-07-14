# Issue #345 高影響操作フィードバック 作業レポート

- 実施日時: 2026-07-14 20:08 JST
- 対象 issue: `https://github.com/tsuji-tomonori/rag-assist/issues/345`
- branch: `codex/issue-345-risky-operation-feedback`
- task: `tasks/do/20260714-issue-345-risky-operation-feedback.md`
- 依存 draft PR: `#348`, `#349`, `#350`, `#351`

## 受けた指示

Issue #345 全体完了へ向け、専用 worktree / task / commit / draft PR workflow で作業を継続する。本 milestone では `FR-096` の target、影響、回復条件、理由、処理状態、結果根拠を代表的な高影響操作へ適用する。

## 要件整理

- confirmation は利用者向け target、影響、回復/取消条件、確認理由を示す。
- processing / success / failure / partial / unknown を affected item と関連付ける。
- duplicate submit を防ぎ、timeout/network を根拠なく成功または確定失敗へ変換しない。
- actor / result reference / version / audit reference は API が許可範囲で返す値だけを使う。
- UI confirmation や client-side permission を server authorization の代替にしない。

## 検討・判断

- mutation の成功と後続 refresh の成功を分離した。mutation 確定後の refresh failure は `partial` とし、再実行による二重操作を促さない。
- HTTP 408/504、abort、代表的な network/timeout error を `unknown` とした。通常の validation/implementation `TypeError` は確定失敗として区別する。
- API 未提供の actor/audit は生成しない。管理上必要な画面では「API 応答で未提供」と明示する。
- confirmed mutation 後の refresh error detail は developer log に限定し、通常 UI には安全な固定 recovery 文面だけを表示する。
- API route、authorization、domain mutation は変更せず、既存の `FR-066`, `FR-078`, `FR-080`, `FR-085`, `FR-086` を正本として維持したため、domain/API requirement 本文の挙動変更は不要と判断した。横断 UI behavior は `FR-096` と `DES_UI_UX_001` へ記録した。

## 実施作業

- shared `OperationOutcome`、network/timeout classifier、target-attached `OperationFeedback` と unit/component tests を追加した。
- history delete を API 確定後削除へ変更し、結果不明時は対象を保持した。最後の履歴削除後も empty state の外で確定結果を保持する。
- documents の delete response を破棄せず `documentId` / `deletedVectorCount` として受け取り、delete/share/folder policy/reindex stage・cutover・rollback の API evidence と partial/unknown を表示した。
- benchmark start/cancel に重複 guard、取消 confirmation、run row に紐づく結果と API actor/run/version evidence を追加した。
- admin user status/role、alias disable/publish に outcome を返し、失敗/unknown では dialog を閉じず、親 panel に target-attached result を保持した。
- `E2E-UI-RISK-001` へ delete/share/cancel/publish の request、confirmation、結果根拠と axe assertion を追加した。
- `FR-096`、`DES_UI_UX_001`、requirements coverage、UI trace manifest、generated Web inventory を同期した。

## 成果物

- `apps/web/src/shared/ui/operationOutcome.ts`
- `apps/web/src/shared/ui/OperationFeedback.tsx`
- history / documents / benchmark / admin の hooks・components・tests
- `apps/web/e2e/visual-regression.spec.ts` の `E2E-UI-RISK-001`
- `docs/1_要求_REQ/.../REQ_FUNCTIONAL_096.md`
- `docs/3_設計_DES/21_UI_UX/DES_UI_UX_001.md`
- `tools/web-inventory/ui-traceability.json` と `docs/generated/web-*`

## 検証

- focused Web tests: pass（11 files / 146 tests）。
- Web full coverage: 初回 3 件 fail。追加 UI に対する曖昧な query と削除 JSON fixture を修正後 pass（45 files / 357 tests、statements 91.81%、branches 85.23%、functions 92.71%、lines 94.69%）。
- `E2E-UI-RISK-001`: 通常 sandbox は `tsx` IPC socket `EPERM`。承認済み権限委譲後、test assertion と empty-state feedback 回帰を修復して Chromium 1 test pass。
- `task verify`: pass（lint、全 workspace typecheck/build）。既存の Vite chunk / infra bundle size warning は残る。
- API requirements coverage + access-control static policy: pass（2 tests、cwd `apps/api`）。
- `task docs:check`: pass。
- semantic UI contract: pass。
- `git diff --check`: pass。

## 指示への fit 評価

| 観点 | 評価 | 根拠 |
| --- | --- | --- |
| target / impact / recovery / reason | fit | 代表 delete/share/cancel/publish と関連 operation の confirmation/result に追加した。 |
| false success/failure 防止 | fit | duplicate guard、partial、unknown と dialog 維持を test した。 |
| evidence / audit honesty | fit | API 応答値のみ表示し、未提供値と未実施検証を明示した。 |
| authorization boundary | fit | API policy 非変更、server guard を正本として static policy test を通した。 |
| docs / trace sync | fit | canonical design/requirement、manifest、generated inventory を同一差分で更新した。 |

## 未対応・制約・リスク

- 代表 screen reader、200%/400% browser zoom、real device、Firefox/WebKit は未実施であり、manual/cross-screen task に残る。
- questions、documents の全操作、admin remaining governance を含む exhaustive coverage は未主張で、既存後続 task に trace した。
- draft PR 作成、受け入れ確認・セルフレビューコメント、CI 結果、task の `done` 移動は workflow 後半で追記する。
- dependent draft PR #348〜#351 が未 merge のため、本 PR も依存解消までは draft とする。
