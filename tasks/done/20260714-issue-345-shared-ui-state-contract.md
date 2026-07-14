# Issue #345 共通 UI state と回復契約を実装する

保存先: `tasks/done/20260714-issue-345-shared-ui-state-contract.md`

状態: done

タスク種別: 機能追加

依存: draft PR #348 の UI trace foundation と draft PR #349 の route/navigation behavior。未 merge のため本 branch は #349 lifecycle head `d7b8d611` から作成し、default branch merge 前に依存を解消する。

## 背景

共通 error は文字列 banner 中心で、loading、empty、permission、partial、stale、retry を画面横断で区別できず、false zero/blank や対象不明の失敗を生み得る。

## 目的・対象範囲

`FR-095` に基づく shared state primitive と feature adapter を導入し、主要 view の非定常状態を visible/programmatic に区別して対象付き recovery を提供する。

## 必要情報

- gap: `GAP-UI-003`
- 検証 ID: `E2E-UI-STATE-001`
- No Mock Product UI: 未取得値を固定 count/date/user/capacity で補わない

## 実行計画

1. state discriminated union と public-safe display metadata を設計する。
2. status/alert/busy/target/retry primitive を native semantics 中心に実装する。
3. chat/history/questions/documents/benchmark/admin へ段階適用する。
4. variant component test と representative E2E を追加する。

## 作業前チェックリスト

- [x] chat/history/questions/documents/benchmark/admin の loading/empty/error/permission/partial/stale/retry 表現と false-zero risk を source/test から棚卸しする。
- [x] public-safe target/message/action と `aria-busy` / alert / status / focus の共通 contract を正規要件・設計へ対応付ける。
- [x] production 値は API/props/state/config のみを使い、test fixture を production fallback へ混ぜない方針を固定する。
- [x] API/RAG/authorization schema を変更せずに適用できる範囲と、別 task が必要な不足を明示する。

棚卸し結果: 初回取得失敗が空配列・0件 KPI・`未提供`へ見える箇所、全体 banner だけに紐づく mutation error、複数 endpoint の全-or-nothing 読み込みを確認した。共通 primitive/controller と feature adapter で修復し、API/RAG/authorization schema は変更しない。代表 screen reader と実 device/zoom は別 manual evidence task のまま残す。

## Done 条件

- [x] shared state model/primitive と feature adapter が loading/empty/error/permission/partial/stale/retrying/recovered を型・semantics・操作で区別する。
- [x] representative six-view behavior と retry/partial/false-zero prevention が component/E2E で観測可能である。
- [x] Web lint/typecheck/test/build、target E2E、docs/inventory、pre-commit が成功する。
- [x] FR-095/NFR-017/DES、trace/generated docs、report、PR acceptance/self-review が同期し、全受け入れ条件を満たす。

## 完了結果

- code-validation head: `4d2777ef`
- draft PR: #350
- 受け入れ条件コメント: `issuecomment-4966526682`
- セルフレビューコメント: `issuecomment-4966526903`
- representative screen reader、実 touch/zoom/device、axe、Firefox/WebKit は本 task の実施済み証跡に含めず、Issue #345 の manual/automated/cross-screen tasks に維持する。

### PR CI 修復（2026-07-14）

- GitHub Actions run `29315153717` で、完了後に移動した task の旧 `tasks/todo/` trace と、Web branch coverage 84.99% を検出した。
- `FR-095` の trace を実在する `tasks/done/` path へ更新し、shared resource state helper の confirmed/unconfirmed、content retention、busy、part availability 分岐を振る舞いテストで補った。coverage threshold は変更していない。
- API full coverage は 773 tests pass、Web full coverage は 40 files / 338 tests pass、Web branch coverage は 85.08% で成功した。
- API/Web typecheck、repository lint、`task docs:check` も再実行して成功した。

## ドキュメントメンテナンス計画

`FR-095`, `NFR-017`, `DES_UI_UX_001`、feature docs と generated a11y inventory を同期する。API error schema を変更する場合は API docs/test を同一 scope で更新する。

## 受け入れ条件

- [x] loading/empty/error/permission/partial/stale/retrying/recovered が異なる state として表現される。
- [x] target region、原因の public-safe 表示、許可された retry/back/support action が関連付く。
- [x] alert/status/busy semantics と focus behavior が keyboard/screen reader で認識できる。
  - component/E2E で role、live、busy、focus、accessible target/action を確認した。代表 screen reader を使った手動 journey 証跡は `tasks/todo/20260714-issue-345-manual-a11y-evidence.md` に残し、本 task では実施済みとしない。
- [x] failure/未取得/permission を 0 件または blank に変換しない。
- [x] retry 成否と partial result が対象単位で更新される。

## 検証計画

- shared primitive component test
- representative state fixture E2E/axe/manual screen-reader check
- Web lint/typecheck/test/build、inventory/docs check

## PR レビュー観点

API detail の過剰開示、generic global-only message、mock fallback、feature 独自 state の意味変化がないか確認する。

## 未決事項・リスク

一括移行は regression が大きいため、contract を固定して feature ごとに完了 evidence を残す。
