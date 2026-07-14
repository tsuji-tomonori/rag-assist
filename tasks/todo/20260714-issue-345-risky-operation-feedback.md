# Issue #345 高影響操作の対象・影響・結果表示を統一する

状態: todo

タスク種別: 機能追加

## 背景

削除、共有、権限変更、停止、無効化、公開、cutover、rollback の確認と結果が feature ごとに異なり、対象や回復可否を誤認するリスクがある。

## 目的・対象範囲

documents、questions、benchmark、admin の代表操作へ `FR-096` の confirmation/progress/result contract を適用する。domain mutation と API authorization は既存要件を正とする。

## 必要情報

- 要件: `FR-096`, `FR-066`, `FR-078`, `FR-080`, `FR-085`, `FR-086`
- 検証 ID: `E2E-UI-RISK-001`
- gap: `GAP-UI-004`

## 実行計画

1. 操作 inventory と recoverability/reason/audit metadata を棚卸しする。
2. target/effect/recovery/reason を持つ shared dialog/result contract を作る。
3. representative feature へ適用し duplicate/timeout/partial/unknown を扱う。
4. API contract/component/E2E/access-control review を行う。

## ドキュメントメンテナンス計画

`FR-096`, `DES_UI_UX_001` と各 domain requirement/API docs を同期する。表示できない audit field は架空値で補わず unavailable とする。

## 受け入れ条件

- [ ] confirmation に利用者向け target、影響範囲、回復/取消条件、必要理由がある。
- [ ] processing/success/failure/partial/unknown が affected item と関連付く。
- [ ] duplicate submit を防ぎ、timeout を根拠なく成功/失敗に確定しない。
- [ ] API が返す actor/result/version/audit reference を許可範囲で調査できる。
- [ ] UI confirmation だけで authorization を成立させない。

## 検証計画

- dialog/result primitive component test
- delete/share/cancel/publish/cutover の representative E2E
- API contract/access-control test と Web checks

## PR レビュー観点

対象取り違え、不可逆性、permission 非開示、audit detail、No Mock Product UI を確認する。

## 未決事項・リスク

API が idempotency/result reference を返さない操作は、UI だけで完了扱いにせず API task を分離する。
