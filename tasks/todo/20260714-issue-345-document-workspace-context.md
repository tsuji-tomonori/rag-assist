# Issue #345 document workspace の情報設計と状態保持を完成する

状態: todo

タスク種別: リファクタリング

## 背景

generated inventory で documents は 143 interaction を持つ最も高密度な領域で、primary/detail/risky action の優先度と query/filter/sort/selection/detail の復元契約が部分的である。

## 目的・対象範囲

`DocumentWorkspace` と document URL state を対象に、主要 job を中心とした progressive disclosure、現在 context、state restoration、extreme content handling を `FR-097`, `FR-098` に適合させる。

## 必要情報

- gap: `GAP-UI-005`
- 検証 ID: `E2E-UI-DOCUMENTS-001`
- 既存 document permission/lifecycle 要件と API を正とする

## 実行計画

1. reader/uploader/share-manager/reindex-operator の job/action hierarchy を定義する。
2. primary/detail/risky controls を permission と selection context で段階化する。
3. URL/state parser と visible filter/source/as-of/selection を同期する。
4. zero/many/long/error/permission/stale と keyboard/mobile を検証する。

## ドキュメントメンテナンス計画

`FR-097`, `FR-098`, `DES_UI_UX_001`、document design/API examples と generated inventory を同期する。操作削除ではなく発見性と hierarchy を変更した場合も記録する。

## 受け入れ条件

- [ ] primary job/action と detail/risky action の reading/visual priority が区別される。
- [ ] search/filter/sort/source/as-of/selection が可視で、reload/back/detail return 後に仕様どおり復元する。
- [ ] invalid/obsolete/unauthorized state は protected data を示さず説明付きで正規化する。
- [ ] 0件、多数件、長い名前、error/stale でも current target と primary action を失わない。
- [ ] disclosure が permission、critical state、risk を隠さない。

## 検証計画

- URL/state/component unit test
- documents E2E、320/375/768/1280px visual、keyboard/axe/manual
- Web/API relevant tests、inventory/docs check

## PR レビュー観点

認可境界、共有/削除/reindex の意味、RAG evidence lifecycle、mock fallback、URL の機微情報を確認する。

## 未決事項・リスク

大規模 layout 変更は job 単位の複数 PR に分け、各 PR で操作到達性を維持する。
