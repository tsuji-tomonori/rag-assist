# Benchmark start smoke の結果 locator を対象領域へ限定する

状態: do

タスク種別: 修正

## 背景

PR #352 を latest `main` へ統合後、Chromium smoke 13件と risky-operation E2E 1件のうち、benchmark start smoke だけが strict mode violation で失敗した。高影響操作の結果表示により、API が返した同じ run ID が履歴 row、操作対象識別子、結果参照に表示されるようになった。

## 目的・対象範囲

Benchmark start smoke が、画面全体で文字列が一意であることではなく、起動した run が実行履歴 row に追加されたことを検証する。production UI/API/RAG/認可は変更しない。

## なぜなぜ分析

### 問題文

2026-07-15、PR #352 worktree の `@smoke|@risky-operation` Chromium run で、`bench-visual-created` の locator が3要素に一致し、14件中1件が失敗した。

### 確認済み事実

- risky-operation E2E を含む13件は成功した。
- `bench-visual-created` は履歴 table の `<code>`、operation feedback の対象識別子、結果参照に表示された。
- 3値はいずれも同じ API response に由来し、架空値や重複 mutation ではない。
- failing assertion は `page.getByText(..., { exact: true })` で画面全体を探索した。
- test の目的はボタンの非重複配置と、確認後に作成済み run が履歴へ現れることの確認である。

### 因果ツリー

- 直接原因: 画面全体の exact text locator が、意図した履歴 row 以外の正当な evidence 表示にも一致した。
- 流出原因: operation feedback 導入前は同じ run ID の表示箇所が1つで、locator の過広な探索境界が顕在化しなかった。
- 局所要因: assertion が table row または region に限定されていなかった。
- 根本原因: test postcondition が「run row が追加された」ではなく「文字列が画面内にある」という弱く曖昧な契約だった。

### 対策

- 作成済み run ID を含む table row を role で特定し、visible を確認する。
- risky-operation E2E と smoke 全件を再実行する。
- Web coverage、typecheck、build、lint、docs check を維持する。

## 受け入れ条件

- [x] benchmark start smoke が作成済み run の履歴 row を一意に検証する。
- [x] operation feedback の正当な対象識別子・結果参照表示を削除または弱体化しない。
- [x] risky-operation E2E と Chromium smoke 全件が成功する。
- [x] Web coverage branch 85%以上、typecheck、build、lint、docs check が成功する。
- [x] production UI/API/RAG/認可、benchmark期待語句、dataset/no-mock 境界を変更しない。

## 実施結果

- 画面全体の exact text assertion を、`bench-visual-created` を accessible name に含む table row assertion へ変更した。
- operation feedback の対象識別子と結果参照表示は変更していない。
- 対象 Chromium test 1/1、smoke 13 + risky-operation E2E/axe 1 の14/14が成功した。
- 検証全体は `reports/working/20260715-1712-benchmark-smoke-locator-scope.md` に記録した。

## ドキュメントメンテナンス計画

製品 behavior と正規要件は変更しないため canonical docs 更新は不要。task と作業レポートに test boundary 修正を記録する。

## 未決事項・リスク

- representative screen reader、実機、実browser zoom、Firefox/WebKit は本修正の対象外で、既存 manual/cross-screen task を維持する。
