# 安全な共有・reader contract の実装

- 状態: todo
- タスク種別: 機能・セキュリティ実装
- 作成日: 2026-07-13
- 関連要件・gap: `FR-061`–`FR-065`, `FR-077`, `FR-078`, `FR-081`, `FR-085`, `FR-087`, `FR-091`, `SQ-009`, `GAP-RD-005`–`GAP-RD-008`, `GAP-RD-023`

## 背景

read 権限と Web 導線、principal 選択、同一 tenant 検証、reader schema、共有と move の atomicity が baseline に未達である。

## 目的と範囲

共有 audience、effective permission、safe reader response、存在秘匿、同一 tenant principal 検証を API/Web/store で揃える。継承 policy と move 実装は既存の `folder-sharing-inheritance-policy`、`document-move-between-folders` task と分担する。

## 受け入れ条件

- [ ] read-only 利用者が許可資源だけを閲覧でき、管理操作は表示・実行できない。
- [ ] principal 候補と share mutation が tenant 境界および許可種別を強制する。
- [ ] reader response/error/count が不要な principal、metadata、資源存在を漏らさない。
- [ ] share/move の version conflict と partial update を fail closed にする。

## 検証・文書

- API contract/authorization/store test と Web access/empty/error state test を実行する。
- sharing matrix、API/data design、該当 FR/SQ を実装に同期する。

## リスク

継承、direct grant、move source permission は `OQ-RD-002`, `OQ-RD-003`, `OQ-RD-012` の決定に依存する。
