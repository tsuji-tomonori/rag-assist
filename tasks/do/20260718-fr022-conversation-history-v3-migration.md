# Issue #358 FR-022 会話履歴schema v3 migration契約

- 状態: do
- タスク種別: 修正
- 対象: Issue #358 P1-A / FR-022

## 背景

旧PR #398はcurrent writeをschema v2としていたが、PR #380と#444によりmainの会話履歴正本はschema v3となった。旧差分をそのまま取り込むと`sessionDocumentContext`を失うため、v3を正本としてmigration契約を再構成する。

## 受け入れ条件

- [ ] persisted version欠落をlegacy v1として読み取る。
- [ ] explicit v1、v2、v3を読み取る。
- [ ] unknown versionをfail closedで拒否する。
- [ ] 新規保存をschema v3へ正規化する。
- [ ] version欠落、v1、v2の更新保存をschema v3へ昇格する。
- [ ] v3更新時にmessages、summary、citation、task state、tool invocation、`sessionDocumentContext`を保持する。
- [ ] readだけでは永続データを書き換えない。
- [ ] API、shared contract、Web producer、store、正本文書のversion語彙を同期する。
- [ ] 実AWS itemの一括rewriteを実施せず、未検証として明示する。
- [ ] contract、API、Web、docs freshness、root CIが成功する。

## Scope out

- 実AWS item分布の調査
- production一括migration
- Phase C Web/history UI
- deploy／release

## 競合解消方針

- mainのschema v3と`sessionDocumentContext`を正本とする。
- 旧PR #398からはlegacy read、unknown reject、write-time promotion、no-write-on-readの契約だけを移植する。
- 生成文書はsource解消後に正規generatorで再生成する。
