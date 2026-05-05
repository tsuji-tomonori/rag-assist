# 作業完了レポート

保存先: `reports/working/20260505-2202-threshold-clause-polarity.md`

## 1. 受けた指示

- PR レビュー指摘を受け、1 文内に「必要」と「不要」が同居する金額閾値ポリシーで誤回答しないよう再修正する。
- 例: `1万円以上の経費精算では領収書の添付が必要で、1万円未満では不要です。`
- `15000円` は必要、`5200円` は不要として扱えることを確認する。

## 2. 要件整理

| 要件ID | 指示・要件 | 重要度 | 対応状況 |
|---|---|---:|---|
| R1 | sentence 全体ではなく clause 単位で polarity を判定する | 高 | 対応 |
| R2 | 正順の必要/不要同居文で `15000円` を required + true にする | 高 | 対応 |
| R3 | 逆順の必要/不要同居文で `15000円` と `5200円` を正しく扱う | 高 | 対応 |
| R4 | 回帰テストを追加する | 高 | 対応 |
| R5 | 検証して PR に反映する | 高 | 対応 |

## 3. 検討・判断したこと

- sentence 全体に `不要` が含まれるかで `polarity` を決めると、同一文内の最初の閾値条件と別 clause の否定語が誤結合する。
- clause 単位で threshold と polarity を結びつけることで、`1万円以上 ... 必要` と `1万円未満 ... 不要` を別の computed fact として扱う方針にした。
- 逆順文では最初の clause が非該当になる場合があるため、生成後に `satisfiesCondition=true` の候補を優先して返すようにした。
- computed fact id は並べ替え後に再採番し、先頭候補が `threshold-001` になるようにした。

## 4. 実施した作業

- `extractRequiredThresholdConditions` を clause 複数候補生成に変更した。
- `splitPolicyClauses` を追加し、句読点・セミコロン相当で clause を分割した。
- threshold fact の返却順を `satisfiesCondition=true` 優先にした。
- 正順・逆順の必要/不要同居文に対する `computation.test.ts` 回帰テストを追加した。
- end-to-end の `graph.test.ts` に clause-level polarity の回帰テストを追加した。
- Computation Layer 設計文書に clause-level polarity の扱いを追記した。

## 5. 成果物

| 成果物 | 形式 | 内容 | 指示との対応 |
|---|---|---|---|
| `memorag-bedrock-mvp/apps/api/src/agent/computation.ts` | TypeScript | clause 単位の threshold / polarity 抽出 | R1-R3 |
| `memorag-bedrock-mvp/apps/api/src/agent/computation.test.ts` | TypeScript test | 正順・逆順の必要/不要同居文テスト | R4 |
| `memorag-bedrock-mvp/apps/api/src/agent/graph.test.ts` | TypeScript test | E2E の clause-level polarity テスト | R4 |
| `memorag-bedrock-mvp/docs/3_設計_DES/11_詳細設計_DLD/DES_DLD_005.md` | Markdown | 設計前提の更新 | R5 |

## 6. 検証

- `./node_modules/.bin/tsx --test apps/api/src/agent/computation.test.ts apps/api/src/agent/graph.test.ts apps/api/src/agent/nodes/node-units.test.ts`: pass
- `npm --prefix memorag-bedrock-mvp run typecheck -w @memorag-mvp/api`: pass
- `npm --prefix memorag-bedrock-mvp run test -w @memorag-mvp/api`: pass
- `npm --prefix memorag-bedrock-mvp run lint`: pass
- 同一文に必要/不要が同居する mock service 確認で、`15000円` は「必要」、`5200円` は「不要」: pass

## 7. 指示へのfit評価

総合fit: 5.0 / 5.0（約100%）

理由: 指摘された P1 ケースを実装修正し、正順・逆順・E2E の回帰テストと API 全体検証まで完了した。

## 8. 未対応・制約・リスク

- clause 分割は MVP の heuristic であり、任意の複雑な日本語条件文を完全に構文解析するものではない。今回のレビュー指摘ケースと一般的な句読点区切り条件文を安全に扱う範囲で対応した。
