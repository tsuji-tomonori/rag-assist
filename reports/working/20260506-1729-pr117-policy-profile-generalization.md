# 作業完了レポート

保存先: `reports/working/20260506-1729-pr117-policy-profile-generalization.md`

## 1. 受けた指示

- PR #120 の「固定値を使わず、profile / policy に寄せて汎化する」考え方に合わせて PR #117 を修正する。
- 既存の policy extraction guard は維持しつつ、比較表現・効果表現の固定対応を汎用化する。
- main にマージ済みの #120 を取り込み、作業ブランチを最新構造へ合わせる。

## 2. 要件整理

| 要件ID | 指示・要件 | 重要度 | 対応状況 |
|---|---|---:|---|
| R1 | PR #120 の profile / policy 方針を確認する | 高 | 対応 |
| R2 | #120 マージ後の `origin/main` を PR #117 worktree に取り込む | 高 | 対応 |
| R3 | comparator / effect のテキスト対応を固定 map から `AnswerPolicy` へ移す | 高 | 対応 |
| R4 | prompt / mock / tests / docs を新方針に合わせる | 高 | 対応 |
| R5 | 変更範囲に応じた検証を実行する | 高 | 対応 |

## 3. 検討・判断したこと

- #120 は SWEBOK 固有のルールや検索・回答ポリシーを `profiles.ts` / `runtime-policy.ts` へ分離していたため、policy extraction の比較語・効果語も同じ `AnswerPolicy` 所有にした。
- deterministic guard は自然文理解を増やさず、quote 由来 span と active policy の text mapping の照合に限定した。
- `policyExtractionToComputedFacts` は runtime default の `ragRuntimePolicy.profile.answerPolicy.policyComputation` を使い、テストでは custom policy を注入できる形にした。
- confidence threshold も固定 `0.75` ではなく `ragRuntimePolicy.confidence.computedFact` を default にした。

## 4. 実施した作業

- `origin/main` を merge し、PR #120 の profile / policy 基盤を取り込んだ。
- `AnswerPolicy` に `policyComputation.comparatorTextMappings` / `effectTextMappings` を追加した。
- `policy-computation.ts` から comparator / effect の固定 RegExp map と固定表示 label を撤去し、active policy の mapping を参照するように変更した。
- `FINAL_ANSWER_JSON` と `ANSWER_SUPPORT_JSON` の effect 表示規約を active policy から生成するように変更した。
- `POLICY_COMPUTATION_EXTRACTION_JSON` prompt に active policy 由来の `policyComputationTextMap` を注入するように変更した。
- mock model の threshold answer も policy の primary effect label を参照するように変更した。
- custom policy の語彙で computed fact が生成できる regression test を追加した。
- `DES_DLD_005.md` と `DES_DATA_001.md` に active policy による policy computation mapping を反映した。

## 5. 成果物

| 成果物 | 形式 | 内容 | 指示との対応 |
|---|---|---|---|
| `memorag-bedrock-mvp/apps/api/src/rag/profiles.ts` | TypeScript | policy computation mapping を `AnswerPolicy` に追加 | #120 方針への適合 |
| `memorag-bedrock-mvp/apps/api/src/agent/policy-computation.ts` | TypeScript | 固定 map を撤去し active policy mapping へ移行 | guard の汎化 |
| `memorag-bedrock-mvp/apps/api/src/rag/prompts.ts` | TypeScript prompt | effect 規約と extraction text map を policy 生成へ変更 | prompt の汎化 |
| `memorag-bedrock-mvp/apps/api/src/adapters/mock-bedrock.ts` | TypeScript mock | mock answer の effect label を policy 参照へ変更 | テスト互換 |
| `memorag-bedrock-mvp/apps/api/src/agent/policy-computation.test.ts` | TypeScript test | custom policy mapping の回帰テスト追加 | 汎化検証 |
| `memorag-bedrock-mvp/apps/api/src/rag/profiles.test.ts` | TypeScript test | `AnswerPolicy` が policy computation mapping を所有することを検証 | profile 契約検証 |
| `memorag-bedrock-mvp/docs/3_設計_DES/11_詳細設計_DLD/DES_DLD_005.md` | Markdown | computation layer 詳細設計更新 | docs maintenance |
| `memorag-bedrock-mvp/docs/3_設計_DES/31_データ_DATA/DES_DATA_001.md` | Markdown | `AnswerPolicy` データ設計更新 | docs maintenance |

## 6. 検証

| コマンド | 結果 |
|---|---|
| `./node_modules/.bin/tsx --test apps/api/src/agent/policy-computation.test.ts apps/api/src/rag/profiles.test.ts apps/api/src/rag/prompts.test.ts apps/api/src/rag/text-processing.test.ts` | pass: 26 tests |
| `npm --prefix memorag-bedrock-mvp run typecheck -w @memorag-mvp/api` | pass |
| `npm --prefix memorag-bedrock-mvp run test -w @memorag-mvp/api` | pass: 143 tests |
| `npm --prefix memorag-bedrock-mvp run lint` | pass |
| `git diff --check` | pass |
| `pre-commit run --files <changed-files>` | pass |

## 7. 指示へのfit評価

総合fit: 4.8 / 5.0（約96%）

理由: #120 の profile / policy 分離方針に合わせ、固定対応を production code から `AnswerPolicy` へ移し、custom policy での回帰テストまで追加した。実 LLM での動作確認は行っていないが、mock と deterministic layer の契約は API 全体テストで検証済み。

## 8. 未対応・制約・リスク

- default policy の mapping は MVP 用の初期値として `profiles.ts` に残る。ドメインごとの差し替えは `AnswerPolicy` の追加・選択で行う前提。
- 複雑な言い換えや逆順表現は引き続き安全側で computed fact を生成しない。
- 実 Bedrock / 実 LLM の確認は未実施。
