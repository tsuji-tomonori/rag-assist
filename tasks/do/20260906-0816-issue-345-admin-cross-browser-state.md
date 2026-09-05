# Issue #345 管理画面の cross-browser state を必須 gate にする

状態: do

タスク種別: 機能追加

## 背景

PR #470 の Firefox／WebKit 必須 gate は管理画面の keyboard・semantic・reflow を検証する一方、`loading / partial / retry / recovered / stale / permission` の状態境界は Chromium の `E2E-UI-STATE-001` と route test に限られる。`DES_UI_UX_001` と UI trace の admin 行にも `AC-SQ016-007` がなく、画面から受け入れ条件・E2Eへの追跡が途切れている。

## 目的

管理画面について、`admin → SQ-016 → AC-SQ016-007 → E2E-UI-CROSS-BROWSER-STATE-006` を一意に追跡し、Firefox／WebKit の PR 必須 gate で部分失敗、stale data保持、retry recovery、権限拒否時のrequest抑止を検証する。

## 対象範囲

- `apps/web/e2e/cross-browser-state.spec.ts` の deterministic route fixture と assertion
- `SQ-016`、`NFR-018`、`DES_UI_UX_001`、UI quality matrix、trace metadata
- 生成 Web inventory と必須 gate の件数表記
- Draft PR #470、Issue #345、作業レポートの証跡

## 対象外

- production component、API、認可、RAG 契約の変更
- production incident、実 API／AWS 上の管理操作
- 代表 screen reader、native accessibility tree、実ブラウザ 200%／400% zoom、touch／実機
- merge、deploy、release、既存 PR の close

## 実行計画

1. 既存 Chromium admin state scenario を、横断ブラウザ用の独立 scenario として決定的に移植する。
2. loading、partial、retrying、recovered、source/as-of付きstale保持、権限拒否とprotected request抑止を検証する。
3. 正本・trace metadata・quality matrix を同じ evidence ID に同期し、生成物を repository command で更新する。
4. 最小十分な lint、typecheck、unit、E2E discovery／実走、docs checks を実行し、失敗は修正または未完了として記録する。
5. commit／push 後に Draft PR #470、受け入れ確認、セルフレビュー、Issue #345 を更新する。

## ドキュメントメンテナンス計画

- 要件本文は `SQ-016`／`NFR-018` の検証欄だけを追加し、要件自体を再定義しない。
- `DES_UI_UX_001` は admin state の横断ブラウザ証跡境界を追加する。
- `tools/web-inventory/ui-traceability.json` と `ui-quality-matrix.json` を正本側の join metadata とし、`docs/generated/` は `npm run docs:web-inventory` だけで更新する。

## 受け入れ条件

- [ ] `E2E-UI-CROSS-BROWSER-STATE-006` が Firefox／WebKit 必須 scope に含まれ、loading → partial → retrying → recovered を区別し、成功partを保持して未確認値をfalse zeroへ変換しない。
- [ ] partial／retry中はprivate error detailを公開せず、回復後だけ監査dataを表示する。
- [ ] ユーザー一覧の更新失敗時は最後に確認できた内容と `source / as-of` をstaleとして保持し、次のretryでrecoveredへ戻る。
- [ ] 管理権限不足のdeep linkはpermission alertを表示して正規化し、protected admin requestを発行しない。
- [ ] `admin → SQ-016 → AC-SQ016-007 → E2E-UI-CROSS-BROWSER-STATE-006` が正本・quality matrix・trace metadata・生成 Web inventory で一意に追跡でき、required cross-browser scope の件数が一致する。
- [ ] 選定した lint、typecheck、unit、E2E、docs checks の結果と、未検証の manual evidence／owner 判断を task・PR・Issue に記録する。

## 検証計画

- `git diff --check`
- 対象 ESLint と Web typecheck
- Web unit test と build
- Playwright の対象 test discovery と Firefox／WebKit 必須 scope 実走
- Web trace、quality matrix、inventory freshness、canonical docs、hidden Unicode checks

## PR レビュー観点

- test-only fixture が production behavior、認可、RAG 契約へ混入していないこと。
- 成功part／stale dataを保持し、private detail、false zero、未許可requestを漏らさないこと。
- evidence ID と screen／REQ／AC／E2E の join が重複または孤立していないこと。
- PR #470 の統合済みadmin実装と正本文書を基準にし、旧PRへ重複変更を積まないこと。

## リスク・未完了境界

- Playwright route fixture は production incident、実 API／AWS、実認可設定の証跡ではない。
- Firefox／WebKit の Playwright 実走は代表 screen reader、native AX tree、実 browser zoom、touch／実機を代替しない。
- FR-050／FR-051、TC-003 WebSocket transport判断、OQ-UI-002、API C1 85%、manual evidenceは本 slice の対象外で未完了を維持する。
- 累積 task 全体に manual evidence が残るため、本 task は受け入れ条件確認後も `do` を維持する。

## ローカル検証結果（CI前）

- `npm ci`: pass、505 packages、lockfile変更なし。
- 対象ESLint、Web typecheck、Web build: pass。
- Web unit: 66 files / 473 tests pass。
- Web trace／matrix 13件、semantic UI contract 5件、Web inventory freshness、canonical docs、hidden Unicode、Taskfile alias、`git diff --check`: pass。
- Firefox／WebKit required discovery: 6 files / 56 tests。追加分は3 scenario × 2 browserの6件。
- Firefox／WebKit実走はbrowser本体取得後、hostのGTK4／GStreamer等required library不足によりbrowser context生成前で停止した。OS packageは追加せず、GitHub Actionsの判定を未完了として待つ。
