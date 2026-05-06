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

## 必要情報

- 前提タスク: `reports/tasks/20260506-1203-rag-policy-profile.md`
- 関連調査: `reports/working/20260506-1157-rag-rule-hardcode-review.md`
- 既存の要求分類テストは、過去の誤答回避を守る回帰テストとして扱う。

## 実行計画

1. 要求分類固有の関数、正規表現、固定語彙を一覧化する。
2. domain policy に移すデータ構造を定義する。
3. `prompts.ts` と `context-assembler.ts` の default path から固有語彙を外す。
4. policy 有効時だけ既存の要求分類補正が効くようにする。
5. `validate-citations.ts` の invalid answer 判定を policy driven にする。
6. default policy と SWEBOK policy の両方のテストを追加する。
7. docs / task report に、固有 rule を code default に戻さない方針を明記する。

## 受け入れ条件

- default policy では SWEBOK / ソフトウェア要求分類の固定語彙が自動注入されない。
- SWEBOK policy を明示すると、既存の要求分類回帰テスト相当の保護が働く。
- 分類質問に対する汎用 prompt は domain-neutral な表現になっている。
- invalid answer pattern が policy 定義から参照される。
- 既存の要求分類関連テストが、policy 明示の形で通る。

## 検証計画

- `npm --prefix memorag-bedrock-mvp/apps/api test -- src/rag/prompts.test.ts`
- `npm --prefix memorag-bedrock-mvp/apps/api test -- src/agent/nodes/node-units.test.ts`
- `npm --prefix memorag-bedrock-mvp/apps/api run typecheck`
- `git diff --check`

## 未決事項・リスク

- policy の選択条件を document metadata、benchmark suite、API input のどれに置くかは未決。
- 既存の SWEBOK 固有テストを default behavior と誤解しないよう、テスト名と fixtures の整理が必要。
