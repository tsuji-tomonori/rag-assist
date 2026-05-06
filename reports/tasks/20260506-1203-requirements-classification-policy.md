# 要求分類 Special Case の Policy 隔離

保存先: `reports/tasks/20260506-1203-requirements-classification-policy.md`

## 背景

`prompts.ts`、`context-assembler.ts`、`agent/utils.ts`、`answerability-gate.ts`、`validate-citations.ts` には、SWEBOK / ソフトウェア要求分類に特化した検索 clue、chunk 選択、回答除外ルールがある。特定資料の誤答対策として有効だが、汎用 RAG としては他ドメインの分類質問へ過剰適用される。

## 目的

要求分類固有の rule を production code の default path から外し、domain policy として明示的に有効化する形へ移行する。

## 対象範囲

- `memorag-bedrock-mvp/apps/api/src/rag/prompts.ts`
- `memorag-bedrock-mvp/apps/api/src/rag/context-assembler.ts`
- `memorag-bedrock-mvp/apps/api/src/agent/utils.ts`
- `memorag-bedrock-mvp/apps/api/src/agent/nodes/answerability-gate.ts`
- `memorag-bedrock-mvp/apps/api/src/agent/nodes/validate-citations.ts`
- `memorag-bedrock-mvp/apps/api/src/rag/prompts.test.ts`
- `memorag-bedrock-mvp/apps/api/src/agent/nodes/node-units.test.ts`

## 方針

- 汎用 prompt は「分類質問では根拠 chunk 内で分類対象として明示された項目だけを列挙する」に留める。
- SWEBOK 固有語、invalid answer pattern、要求分類 anchor は `AnswerPolicy` または domain policy に移す。
- 既存テストは domain policy を明示したケースとして維持する。
- default policy では `ソフトウェア要求の分類` や SWEBOK 固有語を検索 clue に自動追加しない。
- SWEBOK policy の選択は document / collection metadata または benchmark suite config に限定し、通常 `/chat` の利用者 input で切り替えない。
- policy 名と version は trace / benchmark に残すが、domain anchor の詳細や raw prompt は通常利用者へ出さない。

## 必要情報

- 前提タスク: `reports/tasks/20260506-1203-rag-policy-profile.md`
- 関連調査: `reports/working/20260506-1157-rag-rule-hardcode-review.md`
- 既存の要求分類テストは、過去の誤答回避を守る回帰テストとして扱う。
- 関連要求・設計:
  - `FR-003`, `FR-004`, `FR-005`, `FR-014`, `FR-015`
  - `SQ-001`, `NFR-010`, `NFR-012`
  - `ASR-TRUST-001`, `ASR-GUARD-001`, `ASR-SEC-*`

## 実行計画

1. 要求分類固有の関数、正規表現、固定語彙を一覧化する。
2. domain policy に移すデータ構造を定義する。
3. `prompts.ts` と `context-assembler.ts` の default path から固有語彙を外す。
4. policy 有効時だけ既存の要求分類補正が効くようにする。
5. `validate-citations.ts` の invalid answer 判定を policy driven にする。
6. 既存の SWEBOK 固有 fixtures / test name は `swebokPolicy` など policy 明示名へ整理する。
7. default policy と SWEBOK policy の両方のテストを追加する。
8. docs / task report に、固有 rule を code default に戻さない方針を明記する。

## 受け入れ条件

- default policy では SWEBOK / ソフトウェア要求分類の固定語彙が自動注入されない。
- SWEBOK policy を明示すると、既存の要求分類回帰テスト相当の保護が働く。
- 分類質問に対する汎用 prompt は domain-neutral な表現になっている。
- invalid answer pattern が policy 定義から参照される。
- policy 選択は document / collection metadata または benchmark suite config で行われ、通常利用者 input では切り替わらない。
- 既存 API の request / response schema に破壊的変更がない。
- debug trace に policy id / version と判定理由が残り、通常利用者へ内部 rule 詳細や raw prompt は露出しない。
- requirements / design docs の更新要否が PR 本文で説明されている。
- 既存の要求分類関連テストが、policy 明示の形で通る。

## 検証計画

- `npm --prefix memorag-bedrock-mvp test -w @memorag-mvp/api -- src/rag/prompts.test.ts`
- `npm --prefix memorag-bedrock-mvp test -w @memorag-mvp/api -- src/agent/nodes/node-units.test.ts`
- `npm --prefix memorag-bedrock-mvp run typecheck -w @memorag-mvp/api`
- RAG 品質差分がある場合: `task benchmark:sample`
- `git diff --check`

## PRレビュー観点

- semver は、domain policy の選択機構を追加するため `minor` を推奨する。内部整理だけで公開挙動が完全互換なら `patch` でもよいが、理由を PR 本文に書く。
- PR 本文に、SWEBOK 固有 rule を default path から外した理由、既存回帰テストの扱い、未確認の RAG 品質リスクを書く。
- prompt 変更が hallucination を増やさず、根拠 chunk に明示された分類だけを列挙する方針を守るか確認する。
- answerability gate、citation validation、support verification の責務が混ざっていないか確認する。
- no-answer、ambiguous query、unsupported citation、SWEBOK policy 有効時 / 無効時の両方がテストされているか確認する。
- debug trace / benchmark artifact に domain anchor や raw prompt が過剰露出しないか確認する。

## 未決事項・リスク

- 未決事項なし。
- 決定事項: policy 選択条件は document / collection metadata と benchmark suite config を優先し、通常 `/chat` の利用者 input では切り替えない。
- 決定事項: 既存の SWEBOK 固有テストは default behavior ではなく、SWEBOK policy 有効時の regression test として改名・整理する。
- リスク: metadata が欠落した既存文書では SWEBOK policy が自動選択されない可能性があるため、default neutral behavior と明示 policy behavior の差分を PR 本文に書く。
