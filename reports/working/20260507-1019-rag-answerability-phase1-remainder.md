# RAG 回答可能性 gate Phase 1 残件対応

## 受けた指示

- main へ merge 済みの Phase 1 から新しいブランチを切り、Phase 1 の残りを対応する。
- 固定語彙や benchmark row 固有の pattern matching ではなく、汎化した実装にする。
- Worktree Task PR Flow に従い、task md、commit、PR、PR コメントまで進める。

## 要件整理

- benchmark rerun で残った `ans-010` 型の誤拒否は、根拠 span が primary fact を支持しているのに、sufficient context judge の自然文 `missingFacts` と検索評価の missing fact id が優先されることが原因。
- `requiredFacts` を fact id で追跡できる contract に寄せ、supported / missing / conflicting の対応付けを required fact id 優先にする。
- primary fact id が supported に含まれる場合は、資料にない追加具体化の不足だけで hard refusal しない。
- primary fact id が missing / conflicting として明示された場合の拒否経路は維持する。

## 検討・判断

- 個別語句の cue list や QA sample 固有値は追加しなかった。
- LLM judge へ `id / necessity / type / description` を渡し、出力側では required fact id を返すよう prompt contract を明示した。
- 既存 judge が自然文を返す場合も壊れないよう、既存の fact id / description 参照による後方互換 matching は維持した。
- README や要求 docs は、今回の内部 prompt contract 変更だけでは公開仕様変更がないため更新不要と判断した。

## 実施作業

- `sufficient-context-gate.ts`
  - required fact を fact id 付き contract として prompt に渡す formatter を追加。
  - supported / missing / conflicting の status 更新を fact id / description 参照 helper に統一。
  - `missingFacts` に primary fact id が明示された場合は拒否し、supported primary fact id がある場合は追加具体化不足の自然文だけで拒否しないよう整理。
- `prompts.ts`
  - sufficient context judge に required fact id ベースの output contract を明示。
  - primary answer span は支持されているが資料にない追加具体化だけが不足する場合の扱いを明記。
- `node-units.test.ts`
  - `ans-010` 相当の、supported primary fact id と追加具体化不足の自然文が同時に返るケースを追加。

## 成果物

- `tasks/do/20260507-1014-rag-answerability-phase1-remainder.md`
- `reports/working/20260507-1019-rag-answerability-phase1-remainder.md`
- `memorag-bedrock-mvp/apps/api/src/agent/nodes/sufficient-context-gate.ts`
- `memorag-bedrock-mvp/apps/api/src/rag/prompts.ts`
- `memorag-bedrock-mvp/apps/api/src/agent/nodes/node-units.test.ts`

## 検証

- `git diff --check`: pass
- `npm ci`: pass
- `npm --prefix memorag-bedrock-mvp run test -w @memorag-mvp/api -- --test-name-pattern "sufficient context|fixed workflow continues"`: pass
  - npm script 展開後、API test suite 全体 154 件が実行され全件 pass。
- `npm --prefix memorag-bedrock-mvp run typecheck -w @memorag-mvp/api`: pass

## fit 評価

- fact id contract による対応付けで、benchmark row id や期待語句固有の分岐を追加せずに Phase 1 残件へ対応している。
- primary fact missing / conflicting の拒否経路は維持しており、単純に refusal を弱める変更にはしていない。
- 公開 API shape は変更していない。

## 未対応・制約・リスク

- benchmark 全量再実行は未実施。前回 rerun artifact の残件原因に対する unit test で検証した。
- deployed model が prompt contract に従わず自然文を返す場合は後方互換 fallback で扱うが、fact id 返却率は今後の benchmark debug で監視が必要。
- `npm ci` で既存の moderate severity vulnerability が 1 件報告されたが、このタスク範囲では dependency update を行っていない。
