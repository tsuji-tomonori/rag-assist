# jp-public-pdf-qa-v1 P0 修正 作業完了レポート

## 受けた指示

`jp-public-pdf-qa-v1` の非OCR PDF QAで、検索済み根拠があるのに回答スロット欠落と false refusal が起きているため、P0改善方針に沿って実装・検証まで進める。

## 要件整理

- 算術・集計不要なPDF QAでは `extract_policy_computations` を実行しない。
- `円滑` を金額シグナルとして扱わない。
- 根拠候補がある場合の過剰 refusal を抑制する。
- 質問文から項目数、日付、場所、組織、節、項目、語句、理由、可否の要求を検出し、回答生成と検証に使う。
- 検索後の context assembly で、列挙根拠が最終回答前に落ちないようにする。

## 検討・判断

- OCR ingest は今回の0% accuracyの直接原因ではないため範囲外とした。
- TOC / section index の本格実装はP1規模のため、P0では短い構造チャンクを保持し、質問要求スロットと coverage check で落ちを検出する方針にした。
- refusal gate は無条件に緩めず、answerability が true、selectedChunks が存在、primary missing/conflict がない、質問語に紐づく根拠がある場合に限定した。
- docs はAPIや運用手順に影響しないため更新不要と判断した。

## 実施作業

- `question-requirements.ts` を追加し、money amount 判定、質問要求スロット検出、回答 coverage check を実装した。
- `graph.ts` で policy computation 実行条件を制限し、質問要求スロットを required facts に反映した。
- `answerability-gate.ts` と `retrieval-evaluator.ts` の money 判定から raw `円` 依存を外した。
- `sufficient-context-gate.ts` で根拠候補ありの `PARTIAL` / 限定的な `UNANSWERABLE` を回答生成へ進める条件を追加した。
- `prompts.ts` と `validate-citations.ts` に質問要求スロットのプロンプト指示と coverage validation を追加した。
- `context-assembler.ts` でリスト・節項目系の短いチャンクを丸ごと保持するようにした。
- Mock と agent / rag テストを更新し、今回の regression case を追加した。

## 成果物

- コード変更: `memorag-bedrock-mvp/apps/api/src/agent/`, `memorag-bedrock-mvp/apps/api/src/rag/`, `memorag-bedrock-mvp/apps/api/src/adapters/mock-bedrock.ts`
- タスク管理: `tasks/do/20260512-0906-jp-public-pdf-qa-p0.md`
- 作業レポート: `reports/working/20260512-0926-jp-public-pdf-qa-p0.md`

## 検証

- `npm exec -- eslint apps/api --cache --cache-location .eslintcache-api --max-warnings=0`: pass
- `./node_modules/.bin/tsc -p apps/api/tsconfig.json --noEmit`: pass
- `./node_modules/.bin/tsx --test apps/api/src/agent/computation.test.ts apps/api/src/agent/nodes/node-units.test.ts apps/api/src/agent/graph.test.ts apps/api/src/rag/prompts.test.ts apps/api/src/rag/text-processing.test.ts`: pass, 106 tests
- `git diff --check`: pass

## fit 評価

- P0の主要要件である computation skip、`円滑` money 誤判定修正、false refusal 抑制、質問要求スロット検出、coverage check、列挙根拠保持を実装した。
- benchmark expected text や dataset row 固有値は実装に入れていない。
- RAGの根拠性を弱めないよう、citation validation と answer support verification は維持し、coverage 不足は refusal として扱う。

## 未対応・制約・リスク

- 実際の `jp-public-pdf-qa-v1` 全量 benchmark は未実行。外部サービス・データセット実行コストがあるため、今回の検証は変更範囲の unit / integration test に限定した。
- TOC / section index、近傍子項目展開、OCR page-level ingest は今回のP0範囲外。
- LLM実回答では prompt 追従差があり得るため、次段で benchmark 実測と追加 tuning が必要。
