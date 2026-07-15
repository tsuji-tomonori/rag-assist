# Chat citation smoke の locator を見出しへ限定する

状態: done

タスク種別: 修正

## 背景

PR #354 を latest `main` へ統合後、Chromium の question journey・smoke・visual 17件中、既存 chat/document smoke 1件が `参照元` の strict mode violation で失敗した。新しい journey status により同じ語が件数、次操作、citation 見出しへ正当に表示される。

## 目的・対象範囲

Citation smoke が画面全体の部分一致ではなく、citation list の `参照元` 見出しを検証するようにする。production UI/API/RAG/認可は変更しない。

## なぜなぜ分析

- 直接原因: `page.getByText('参照元')` が部分一致で3要素を解決した。
- 流出原因: journey status 導入前は同語の表示箇所が少なく、曖昧 locator が顕在化しなかった。
- 根本原因: test postcondition が citation 見出しではなく、画面内の任意の同語へ結合していた。
- 確認済み事実: question journey 2件、visual 2件、他 smoke 12件は成功。3表示はいずれもAPI result/citationに由来する正当な表示である。

## 対策

- `参照元` の exact text を検証し、citation list 見出しへ一意に限定する。
- 対象 test と question journey・smoke・visual 全選択を再実行する。

## 受け入れ条件

- [x] citation smoke が `参照元` 見出しを一意に検証する。
- [x] journey status の件数・次操作表示を削除または弱体化しない。
- [x] 対象 test と選択 Chromium 全件が成功する。
- [x] Web/API full coverage、typecheck、build、lint、docs check が成功する。
- [x] production UI/API/RAG/認可、benchmark/dataset/no-mock 境界を変更しない。

## 実施結果

- `getByText('参照元')` を exact text assertion へ限定した。
- journey status の件数と次操作、citation list の表示は変更していない。
- 対象 Chromium 1/1、question journey・smoke・visual の17/17が成功した。
- 検証全体は `reports/working/20260715-2012-chat-citation-smoke-locator.md` に記録した。

## ドキュメントメンテナンス計画

製品 behavior と正規要件は変わらないため canonical docs 更新は不要。task/report に test boundary 修正を記録する。

## 未決事項・リスク

- screen reader、200%/400% zoom、real device、Firefox/WebKit は既存横断 task の対象。

## PR・CI 証跡

- 受け入れ条件コメント: https://github.com/tsuji-tomonori/rag-assist/pull/354#issuecomment-4979991497
- MemoRAG CI: run `29411111756` success（7分35秒）
- Validate Semver Label: run `29411111769` success
- Explicit RAG candidate promotion gate: 条件非該当のため skipped
