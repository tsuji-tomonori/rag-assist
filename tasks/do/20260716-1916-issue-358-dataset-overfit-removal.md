# Issue #358 dataset 過適合除去

- 状態: do
- タスク種別: 修正
- 対象 Issue: `#358`
- 対象要件: `FR-045`、`SQ-003`
- 開始日: 2026-07-16
- オーナー: Codex
- 完了期限: 本 PR の受け入れ条件確認コメント完了時

## 背景

Issue #358 の推奨 PR 分割 1 として、production の evidence 採用経路に残る SWEBOK dataset 固有語句と dataset 固有分岐を除去し、別 corpus にも同じ根拠性 policy が成立する状態へ直す。

## 目的

- 回答根拠の採用を、質問・文書の意味と汎用的な根拠品質だけで判定する。
- benchmark の期待語句、QA sample 固有値、domain 固有語彙が production policy を迂回しないようにする。
- 既存の refusal、citation、support verification、認可済み chunk の境界を維持する。

## なぜなぜ分析

### 問題文

2026-07-16 時点の `origin/main` 由来 branch では、`grounded-prompt-builder.ts` と `answer-policy.ts` を含む production RAG 経路が、SWEBOK／ソフトウェア要求分類専用の質問・語句・正規表現で evidence の順位付け、採用可否、回答除外を変えている。`FR-045` と `SQ-003` は dataset 固有値を使わない採用・回答可能性 policy を要求しており、実装が要求から外れている。

### 観測事実・証拠

- `confirmed`: `grounded-prompt-builder.ts` の `isRequirementsClassificationQuestion`、`classificationEvidenceScore`、`hasClassificationSectionEvidence`、`countRequirementsClassificationTerms` は「ソフトウェア要求」「SWEBOK」「製品要求」等の固定語句を参照する。
- `confirmed`: 同 helper は chunk 選択だけでなく `answerability-gate.ts` と `citation-validator.ts` から参照され、回答可能性と回答拒否にも影響する。
- `confirmed`: `answer-policy.ts` の `swebokRequirementsAnswerPolicy` は分類 anchor、invalid answer pattern、search clue に SWEBOK dataset 固有語句を保持し、metadata から自動選択する。
- `confirmed`: `context-packer.ts` にも要求分類質問専用の切り出し分岐がある。
- `confirmed`: `FR-045 AC-004` と `SQ-003 AC-001`〜`004` は dataset 固有の期待語句や QA sample 固有値に依存しない汎用判定を求める。
- `confirmed`: 既存 `tasks/todo/20260506-1203-requirements-classification-policy.md` は固有 rule を domain policy として残す方針だが、Issue #358 は本番 evidence 採用経路からの除去と別 corpus での同一 policy を要求する。
- `confirmed`: 現行テストには SWEBOK fixture と default policy の注入有無の確認があるが、別 corpus、言い換え、英語、無関係文書を横断して固有分岐の不在を固定する回帰テストは不足している。

### inferred

- 固有補正は過去の SWEBOK 回帰ケースを改善するため段階的に追加され、policy object へ移したことで「隔離済み」と見なされたが、metadata 自動選択と production helper 呼び出しが evidence 採用経路に残った。
- テストが同じ SWEBOK fixture と語句を中心にしていたため、別 domain で同じ policy が成立しないことと、固有分岐再導入を検出できなかった。

### open question

- 実 LLM の生成品質への影響は、単体テストでは未測定。今回は deterministic な evidence 選択・refusal・citation 契約を検証し、実 Bedrock benchmark は外部サービスを伴うため未実施理由と残余リスクを記録する。

### 因果ツリー

1. 発生: domain 固有補正が production helper と `AnswerPolicy` に実装された。
2. 流出: domain policy へのデータ移動だけを隔離とし、metadata 自動選択と呼び出し先の分岐を静的に禁止しなかった。
3. 検知遅れ: regression test が固有 fixture の正答維持を主眼とし、別 corpus・言語・言い換え・negative case と production taint scan を持たなかった。
4. 影響: evidence 採用、answerability、citation validation が特定 dataset の語句で変化し、benchmark と通常回答の policy 同一性を証明できない。

### root cause

根本原因は、evidence 採用の production policy に domain/dataset 固有語彙を保持できる設計と、それを禁止する自動検査の欠落である。単に正規表現を移動するだけでは再発を防げないため、production 経路を domain-neutral な判定へ統一し、静的回帰テストで再導入を拒否する。

### 全影響範囲

- production: prompt builder、context packing、answerability gate、citation validation、answer policy 選択。
- tests: prompt/chunk selection、answerability、citation、policy、別 corpus と negative case。
- docs: `FR-045`、`SQ-003`、RAG 詳細設計、要件 coverage／生成 docs の同期要否。
- non-impact: API schema、認証・認可 filter、retrieval tenant scope、benchmark dataset adapter は変更しない。

### 対策と原因対応

| 対策 | 原因への対応 | 強さ | 効果指標 |
|---|---|---|---|
| production の固有 helper／policy／自動選択を domain-neutral な根拠判定へ置換 | 発生原因を除去 | 設計変更 | production 対象で固有語句 0 件 |
| 別 corpus・言い換え・英語・無関係文書の回帰テストを追加 | 流出・検知遅れを防止 | 自動検知 | 対象ケースが全 pass |
| 固有語句再導入の静的検査を追加 | 再発防止 | 自動検知 | 禁止語句を入れると test fail |
| 正規 docs と coverage を実装 evidence に同期 | 標準化 | 文書・trace | FR-045/SQ-003 の実装・test 参照が一致 |

## スコープ

### 対象

- `apps/api/src/rag/online/generation/prompt/grounded-prompt-builder.ts`
- `apps/api/src/rag/_shared/policies/answer-policy.ts`
- それらの helper に依存する production evidence 採用経路
- 対応する API unit test／静的検査
- `FR-045`、`SQ-003`、RAG 詳細設計、coverage／generated docs
- `tasks/todo/20260506-1203-requirements-classification-policy.md` のクローズ

### 対象外

- benchmark dataset や expected answer の変更
- 認証・認可・tenant filter の変更
- guard profile 構成検査（Issue #358 推奨 PR 分割 2）
- merge、deploy、release

## 実装計画

1. 固有 helper と policy 選択の全呼び出しを列挙する。
2. chunk 選択、answerability、citation validation を domain-neutral な既存の根拠・support 判定へ統一する。
3. 別 corpus、言い換え、英語、無関係文書の normal／negative test を追加する。
4. production 対象の静的再導入防止 test を追加する。
5. 正規 docs、coverage、generated docs を同期する。
6. targeted test、typecheck、docs check、必要な broader API test を実行し、失敗時は修正・再実行する。

## ドキュメントメンテナンス計画

- `FR-045` と `SQ-003` の状態、変更履歴、実装・test trace を更新する。
- RAG 詳細設計に domain-neutral evidence 採用と禁止事項を記録する。
- coverage と生成 docs は repository の生成／検証コマンドを確認して同期する。
- API request／response schema は不変のため、OpenAPI 更新が不要なら report と PR 本文に理由を記録する。

## 受け入れ条件

- [ ] production evidence 採用経路に SWEBOK dataset 固有語句・dataset 固有分岐が残っていない。
- [ ] benchmark expected 語句、QA sample 固有値を production 実装へ追加していない。
- [ ] 別 corpus、言い換え、英語の同型質問で同じ domain-neutral policy が成立する。
- [ ] 無関係文書を evidence として採用しない negative test が通る。
- [ ] dataset 固有語句を production 対象へ再導入すると静的検査または test が失敗する。
- [ ] 根拠不足 refusal、citation、support verification、認可済み chunk の境界を弱めていない。
- [ ] `FR-045`、`SQ-003`、関連設計、coverage／generated docs が実装・test evidence と同期している。
- [ ] `tasks/todo/20260506-1203-requirements-classification-policy.md` が実態に合わせてクローズされる。
- [ ] 選定した targeted／broader validation が全て pass し、未実施は理由とリスクを記録する。
- [ ] main 向け PR を GitHub Apps で作成し、受け入れ条件確認とセルフレビューの日本語 top-level comment を投稿する。

## 検証計画

- 対象 test ファイルを直接 `tsx --test` で実行。
- `npm run typecheck -w @memorag-mvp/api`
- `npm run test -w @memorag-mvp/api`
- docs 用 Taskfile／npm script の展開内容を確認後、関連 docs check を実行。
- `git diff --check`
- `pre-commit run --files <changed-files>`

## PR レビュー観点

- semver: patch。公開 API を変えず、要求違反の production policy を是正するため。
- dataset 固有分岐を別名・別ファイルへ移しただけになっていないか。
- 汎用化が根拠不足時の refusal、citation support、tenant／ACL filter を弱めていないか。
- static test が fixtures／benchmark／docs まで誤って禁止せず、production 経路だけを監視しているか。
- docs と実装・tests の trace が一致し、未実施検証を pass 扱いしていないか。

## リスク・フォローアップ

- 固有補正除去で従来 SWEBOK sample のスコアが変化し得る。期待語句を実装へ戻さず、必要なら retrieval／context assembly の汎用改善として別 Issue で扱う。
- 実 LLM benchmark は本 PR の unit／contract verification とは分離し、未実施なら CI／運用 evidence 待ちとして明記する。
- フォローアップ日: PR review 時。production taint scan 0 件と対象 tests を再確認する。
