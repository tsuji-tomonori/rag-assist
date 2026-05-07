# HITL review feedback loop の強化

保存先: `tasks/todo/20260507-2000-hitl-review-feedback-loop.md`

## 状態

- todo

## 背景

neoAI Chat の本番運用に近づけるには、回答不能、低信頼、低評価を人手対応に渡し、その結果を RAG 改善へ戻す運用ループが必要である。rag-assist には `questions` API、担当者問い合わせ、回答登録、resolve の導線があるため、これを FAQ 候補、評価データ候補、用語集候補、文書追加候補へ分ける仕組みに拡張できる。

## 目的

人間の回答を即時に RAG 知識へ自動投入せず、review 後に FAQ、評価データ、用語集、alias、chunking、文書追加へ反映できる HITL feedback loop を作る。

## 対象範囲

- `questions` API /担当者問い合わせ/ resolve flow
- admin review API / UI
- FAQ candidate / evaluation candidate / glossary candidate / alias candidate の schema
- audit log / usage / cost dashboard integration
- benchmark dataset update workflow
- docs / operations

## 方針

- 低信頼回答、回答不能、利用者低評価、権限境界に近い問い合わせを HITL candidate にできるようにする。
- 担当者回答は即時に RAG corpus へ投入せず、review status を経て publish する。
- publish 先は FAQ 候補、評価データ候補、用語集候補、alias 候補、不足文書候補に分ける。
- audit log に who / when / source question / reviewed evidence / publish target を残す。
- benchmark へ追加する場合は expectedContains 固有チューニングを誘発しない形式で登録する。
- admin UI は運用上必要な review / publish / reject / audit 確認に絞る。

## 必要情報

- 既存 `questions` API と admin users / roles / audit / usage / costs 導線。
- 既存 benchmark dataset / report 出力。
- 関連 task: `tasks/todo/20260507-2000-rag-baseline-evaluation-set.md`
- 関連 task: `tasks/todo/20260507-2000-assistant-profile-config.md`

## 実行計画

1. 現行 `questions` flow と担当者回答の保存形式を棚卸しする。
2. HITL candidate の status、publish target、review metadata を定義する。
3. 低信頼回答 / 回答不能 / 低評価から candidate を作成する入口を追加する。
4. 担当者が正解、根拠文書、不足文書、候補種別を登録できる API / UI を追加する。
5. review 後に FAQ / benchmark / glossary / alias / document backlog へ publish する処理を追加する。
6. audit log、usage、cost dashboard との関連を残す。
7. docs と operations に review 前回答を自動投入しない原則を明記する。
8. 権限、監査、benchmark 追加のテストを追加する。

## ドキュメントメンテナンス計画

- 要求仕様: HITL、admin review、audit、benchmark dataset、FAQ / glossary / alias 候補に関係する `FR-*`、`SQ-*`、`NFR-*`、`TC-*` を確認する。
- architecture / design: Questions workflow、Admin API、Audit log、Benchmark update flow、RAG knowledge update flow を更新する。
- API examples / OpenAPI: candidate / review / publish API を追加する場合は更新する。
- operations: review 権限、publish 手順、誤回答混入防止、rollback、監査確認を追記する。
- PR 本文: review 前データの扱い、機微情報、未実施 UI / smoke を明記する。

## 受け入れ条件

- 回答不能、低信頼、低評価から HITL candidate を作成できる。
- 担当者回答が review status を持ち、未 review のまま RAG corpus に自動投入されない。
- FAQ 候補、評価データ候補、用語集候補、alias 候補、不足文書候補を区別できる。
- review / publish / reject が audit log に残る。
- publish 後の benchmark 追加が dataset 固有分岐を実装へ要求しない形式である。
- reviewer 権限が route-level permission と store-level owner / role constraint で保護されている。
- operations docs に誤回答混入を防ぐ運用手順がある。

## 検証計画

- `npm --prefix memorag-bedrock-mvp run test -w @memorag-mvp/api`
- admin / questions API permission tests
- Web admin UI を変更する場合: `npm --prefix memorag-bedrock-mvp run test -w @memorag-mvp/web`
- API route 追加時: access-control policy test
- `git diff --check`

## PRレビュー観点

- `blocking`: 未 review の人間回答が自動で検索対象へ混入しないこと。
- `blocking`: review / publish API が認証・認可・監査なしで呼べないこと。
- `blocking`: 権限外文書の存在や内容を candidate / audit / debug trace 経由で漏らさないこと。
- `should fix`: candidate が FAQ、評価、用語集、alias、不足文書のどれに反映されたか追跡できること。
- `question`: benchmark へ publish する時の reviewer と approver を分ける必要があるか。

## 未決事項・リスク

- 決定事項: 人間の回答は review 前に RAG corpus へ自動投入しない。
- 決定事項: HITL output は FAQ、評価データ、用語集、alias、不足文書候補へ分離する。
- 実装時確認: 既存 admin UI の範囲で review 画面まで実装するか、まず API / audit のみで始めるか。
- リスク: HITL candidate に機微情報が含まれるため、audit と debug trace の露出範囲を誤ると情報漏えいにつながる。
