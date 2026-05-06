# 作業完了レポート

保存先: `reports/working/20260506-1615-pr117-condition-effect-guards.md`

## 1. 受けた指示

- PR #117 のレビュー指摘に対し、マージ前に追加 guard を入れる。
- `thresholdText` と `comparatorText` が同じ条件表現に属することを deterministic に検証する。
- `effectText` と `effect` enum の対応関係を deterministic に検証する。
- 既存の「LLM は自然文構造化抽出、code は grounding と検算」という方針は維持する。

## 2. 要件整理

| 要件ID | 指示・要件 | 重要度 | 対応状況 |
|---|---|---:|---|
| R1 | `condition.conditionText` を抽出 schema に追加する | 高 | 対応 |
| R2 | `conditionText` が quote 内に存在し、`thresholdText` と `comparatorText` を同じ条件として含むことを検証する | 高 | 対応 |
| R3 | `effectText` が `effect` enum と固定対応することを検証する | 高 | 対応 |
| R4 | prompt、mock、テスト、設計 docs を更新する | 中 | 対応 |
| R5 | 変更範囲に応じた検証を実行し、未実施事項を明記する | 高 | 対応 |

## 3. 検討・判断したこと

- 自然文の再解釈は追加せず、LLM が抜いた span の provenance validation に限定した。
- `conditionText` は quote 由来の条件全体 span とし、正規化後に `thresholdText + comparatorText` の並びを含む候補だけを採用する方針にした。
- `effectText` は最小表現を prompt で要求し、code 側では既知の固定表現だけを enum に対応付ける。未知表現は computed fact を生成しない。
- `memorag-bedrock-mvp/docs` の該当設計文書は、今回の guard が設計判断に関わるため更新対象と判断した。

## 4. 実施した作業

- `PolicyComputationExtractionSchema` に `condition.conditionText` を追加した。
- `policyExtractionToComputedFacts` に以下の guard を追加した。
  - `conditionText` の quote 内存在確認
  - `conditionText` 内の `thresholdText` / `comparatorText` 存在確認
  - 正規化後の `thresholdText + comparatorText` 近接確認
  - `effectText` と `effect` enum の固定対応確認
- `POLICY_COMPUTATION_EXTRACTION_JSON` prompt と mock Bedrock の policy extraction 出力を新 schema に追従した。
- 条件 span の取り違え、effect enum の取り違えを落とす regression test を追加した。
- 設計文書 `DES_DLD_005.md` に今回の deterministic guard を反映した。

## 5. 成果物

| 成果物 | 形式 | 内容 | 指示との対応 |
|---|---|---|---|
| `memorag-bedrock-mvp/apps/api/src/agent/policy-computation.ts` | TypeScript | `conditionText` と `effectText` 整合性 guard | P1 2 件に対応 |
| `memorag-bedrock-mvp/apps/api/src/agent/policy-computation.test.ts` | TypeScript test | 条件 span / effect enum の回帰テスト | guard の検証 |
| `memorag-bedrock-mvp/apps/api/src/rag/prompts.ts` | TypeScript prompt | LLM 抽出 schema と provenance 制約更新 | prompt 契約の更新 |
| `memorag-bedrock-mvp/apps/api/src/adapters/mock-bedrock.ts` | TypeScript mock | mock extraction の新 schema 対応 | API テスト互換性 |
| `memorag-bedrock-mvp/docs/3_設計_DES/11_詳細設計_DLD/DES_DLD_005.md` | Markdown | 設計 docs の guard 方針更新 | docs maintenance |

## 6. 検証

| コマンド | 結果 |
|---|---|
| `./node_modules/.bin/tsx --test apps/api/src/agent/policy-computation.test.ts` | pass: 8 tests |
| `npm --prefix memorag-bedrock-mvp run typecheck -w @memorag-mvp/api` | pass |
| `npm --prefix memorag-bedrock-mvp run test -w @memorag-mvp/api` | pass: 135 tests |
| `npm --prefix memorag-bedrock-mvp run lint` | pass |
| `git diff --check` | pass |
| `pre-commit run --files <changed-files>` | pass |
| `task docs:check:changed` | not run: この worktree の Taskfile に該当タスクが存在しない |

## 7. 指示へのfit評価

総合fit: 4.8 / 5.0（約96%）

理由: レビュー指摘の P1 2 件は code / prompt / mock / tests / docs に反映し、API typecheck、API test、lint、diff check、pre-commit まで通過した。docs 専用 task は存在しなかったため実行できなかったが、代替として lint、diff check、pre-commit を実施した。

## 8. 未対応・制約・リスク

- `effectText` の固定対応は MVP 向けの既知表現に限定している。未知表現は安全側で computed fact を生成しない。
- `conditionText` の近接確認は正規化後の `thresholdText + comparatorText` の並びに限定している。逆順や複雑な表現は安全側で落とす。
- `task docs:check:changed` はこの worktree の Taskfile に存在しなかったため未実行。
