# Issue #345 UI/UX 追跡性・品質ゲート基盤を確立する

保存先: `tasks/done/20260714-1317-issue-345-uiux-traceability-gate.md`

状態: done

タスク種別: 機能追加

## 背景

GitHub Issue #345 は、UI/UX 改善を単発の画面修正にせず、利用者導線、アクセシビリティ、レスポンシブ、状態表示、正本文書、生成文書、テストを継続的に同期することを求めている。Issue 起票時に競合していた PR #341〜#344 は 2026-07-14 時点ですべて `main` に merge 済みであり、正規文書は `docs/` の REQ/ARC/DES/OPS と `generated` に一意化された。一方、現行の Web inventory freshness は画面要素の静的な鮮度を検査するだけで、`AppView / URL / ペルソナ / 主要ジョブ / 要件 / 受け入れ条件 / E2E` の意味的な参照切れや孤立を検出しない。

本 task は Issue #345 全体完了へ向けた第 1 マイルストーンである。後続の production UI 改善は別 task / PR に分割し、本 task ではそれらを検証可能にする正規トレースと CI 品質ゲートを完成させる。

## 目的

現行実装を一次情報として全 `AppView` の利用者目的と検証経路を双方向に追跡できる正規文書を作り、UI 変更で要件・受け入れ条件・E2E・inventory・PR 記載が stale または孤立した場合に自動検出できる状態にする。

## 対象範囲

- `apps/web/src/` の `AppView`、navigation、permission、主要画面、既存 test / E2E
- `docs/1_要求_REQ/` の UI/UX・アクセシビリティ・追跡性要件と受け入れ条件
- `docs/3_設計_DES/21_UI_UX/` の画面・状態・persona/job・トレース設計
- `docs/generated/` の Web inventory と生成元責務
- `scripts/`、package scripts、`Taskfile.yml`、GitHub Actions の validator 導線
- `.github/pull_request_template.md` の UI 変更確認欄
- `reports/working/` の仕様分析・作業完了レポート
- Issue #345 と PR #341〜#344 の依存・重複・正規文書責務の証跡

production UI の mobile navigation、URL/history、画面別状態契約、管理・文書・チャット画面の具体的な操作改善は後続 task とし、本 task では実装すべき gap と検証 ID を欠落なく起票する。

## 方針

- 現行 `main` のソース、既存 test、正規 docs、merge 済み PR を一次情報とする。
- 事実を `confirmed`、実装から妥当に導く内容を `inferred`、矛盾を `conflict`、決められない点を `open_question` として区別する。
- 要件は 1 要件 1 ファイルとし、各ファイル内に原子的な受け入れ条件と検証 ID を置く。
- authored な分析は `reports/working/`、正規要件・設計は canonical docs、機械生成物だけを `docs/generated/` に置く。
- validator は既存 Web inventory を再実装せず、正規 manifest / docs / test metadata の意味的参照を検査する。
- UI 変更を含む PR だけに追加確認を要求し、docs-only や非 UI 変更へ不要な false positive を出さない。
- RAG の根拠性、認可境界、No Mock Product UI の規約は弱めず、後続 UI task の受け入れ条件へ引き継ぐ。

## 必要情報

- Source issue: `https://github.com/tsuji-tomonori/rag-assist/issues/345`
- PR #341: 再定義要件の production 経路と正規 docs を統合済み
- PR #342: `docs/` を REQ/ARC/DES/OPS/generated の正規構成へ統合済み
- PR #343: API code docs の生成・freshness gate を追加済み
- PR #344: 管理 UI 監査を non-normative report へ移し、残余 gap を task 化済み
- Current base: `origin/main` at `b9fb39becc9a9cdee65c2cd1bfe593b8f6d0309a`
- Existing related tasks:
  - `tasks/todo/20260714-1011-admin-ui-governance-quality.md`
  - `tasks/todo/20260713-2304-responsive-chat-ui-verification.md`
  - `tasks/todo/20260713-2301-user-preferences.md`

## 実行計画

1. 現行 Web implementation、inventory、正規 docs、test、Taskfile/CI、PR template を棚卸しする。
2. Issue #345 を FACT / atomic task / AC / E2E / OP・EXP / REQ・SPEC に分解した仕様分析レポートを作る。
3. UI/UX・a11y・追跡性の原子的な正規要件と UI/UX 設計を作成または更新する。
4. `AppView / URL / permission / persona / job / REQ / AC / E2E / test` manifest と validator を実装する。
5. 正常系と参照切れ・孤立・重複・不正 enum を扱う validator test を追加する。
6. docs check / CI と PR template に UI 同期・a11y・responsive・状態網羅の gate を統合する。
7. 追跡分析で判明した未実装 production UI を重複のない atomic task として `tasks/todo/` に置く。
8. 最小十分な docs、Web、validator、CI 設定検証を実行し、失敗を修正して再実行する。
9. 作業レポート、commit、push、draft PR、受け入れ条件コメント、セルフレビューを完了する。

## ドキュメントメンテナンス計画

- `docs/1_要求_REQ/`: UI 到達性、状態契約、a11y/responsive、URL/history、追跡性・freshness を 1 要件 1 ファイルで定義し、各要件に AC と E2E/non-UI verification を記載する。
- `docs/3_設計_DES/21_UI_UX/`: `AppView` と URL、persona、job、状態、テストの対応および authored/generated 文書の責務を記載する。
- `docs/1_要求_REQ/31_変更管理_CHANGE/REQ_CHANGE_001.md`: source から requirement/test までの双方向 trace を更新する。
- 現行 requirements baseline: 未実装・未検証 gap と対応 task を記録する。
- `docs/generated/`: 生成物の schema と provenance のみ generator 経由で更新し、手書き分析を置かない。
- `README.md` / API examples / OpenAPI / deploy docs: 本 task は public API や deploy runtime を変更しないため原則非該当とし、検査コマンドや contributor workflow が変わる場合のみ最小更新する。
- `.github/pull_request_template.md`: UI 変更時の persona、変更前後、状態、a11y、responsive、docs/inventory/test 同期、未検証を明記できる欄を追加する。
- PR 本文: 未実施の手動 screen reader、real-device、400% zoom 等があれば理由と残余リスクを明記する。

## 受け入れ条件

- [x] AC-345-T01: 現行 production source に存在する全 `AppView` が、安定した view ID、URL、利用可能 permission、persona、主要 job、要件 ID、受け入れ条件 ID、E2E/non-UI 検証 ID、実装/test evidence と双方向に対応する。
- [x] AC-345-T02: validator は view、要件、AC、E2E/test の参照切れ、孤立、重複 ID、不正な permission/view、未登録 production view を fail closed で検出する。
- [x] AC-345-T03: validator の正常 fixture と各失敗分類を対象にした自動 test があり、エラーは修正対象 ID と原因を人が判別できる形で出力される。
- [x] AC-345-T04: UI inventory freshness と新しい意味的 trace validator が repository の docs check および PR CI から実行される。
- [x] AC-345-T05: UI 変更 PR template が、対象 persona、変更前後、loading/empty/error/permission/retry 等の状態、a11y、responsive、canonical docs、generated inventory、unit/E2E/visual/manual 検証、未検証事項を日本語で記録できる。
- [x] AC-345-T06: UI の正本文書、生成文書、test、作業レポートの責務と、PR 間の一時的不整合を許す条件・解消期限・merge blocker が canonical docs に一意に定義される。
- [x] AC-345-T07: PR #341〜#344 の重複・競合が現行 `main` で解消済みであることと、legacy `docs/spec*` を正規文書として復活させないことが trace/gap evidence に記録される。
- [x] AC-345-T08: Issue #345 の全 P0/P1 TODO と全体完了条件が、実装済み evidence または重複しない `tasks/todo/` のいずれかへ対応し、根拠のない「完了」項目がない。
- [x] AC-345-T09: requirement/AC/E2E は `confirmed` / `inferred` / `conflict` / `open_question` を区別し、WCAG 2.2 AA、320/375/768/1280px、200%/400% zoom、keyboard、screen reader、reduced motion、長文、多数件、0件、エラーの必要検証を欠落させない。
- [x] AC-345-T10: Web/API/RAG/認可の production behavior を本 task で不用意に変更せず、No Mock Product UI、RAG 根拠性、アクセス制御境界を弱める差分がない。
- [x] AC-345-T11: 選定した validator test、docs check、関連 Web check、`git diff --check` が成功し、未実施検証は具体的な理由とリスクを task/report/PR に記録する。

## 実施結果

- 8 `AppView` の source guard と manifest、REQ/AC、stable E2E ID、evidence、gap task を validator で同期した。
- `task docs:check`、Web typecheck、37 files / 310 unit tests、targeted ESLint、8-view Chromium smoke、pre-commit、`git diff --check` は成功した。
- existing documents visual baseline は 3% mismatch し、production/CSS と既存 visual blockを変更していないため baseline を更新していない。visual pass は主張せず作業レポートと PR に残す。
- manual screen reader、400% zoom、real-device、axe/mobile/cross-browser required gate は後続 task の `planned` / `manual` evidence として未完了のまま追跡する。

## 検証計画

- `git diff --check`
- 新規 trace validator の unit test（正常、missing ref、orphan、duplicate、invalid enum、unregistered view）
- `python3 scripts/validate_docs.py`
- `python3 -m unittest scripts.test_validate_docs`
- `task docs:check`（実行前に resolved command を確認）
- `npm run docs:web-inventory:check`
- `npm run typecheck -w @memorag-mvp/web`（Web source/type を変更する場合）
- `npm run test -w @memorag-mvp/web`（Web production/test を変更する場合）
- `pre-commit run --files <changed-files>`（利用可能な場合）
- generated manifest と production `AppView` の差分検査

## PRレビュー観点

- PR 全体が Issue #345 第 1 マイルストーンに限定され、後続 production UI 改善を混在させていないか。
- 正規要件・UI 設計・generated inventory・test/CI が同じ ID と責務で同期しているか。
- 要件が実装手段ではなく観測可能な利用者価値として原子的に書かれ、各 AC に検証経路があるか。
- validator が false negative だけでなく UI 非変更 PR への false positive を避ける設計か。
- docs と実装の同期、変更範囲に見合う test、RAG 根拠性・認可境界・No Mock Product UI が維持されているか。
- benchmark 期待語句、QA sample 固有値、dataset 固有分岐を product implementation に導入していないか。
- 実行していない手動 a11y / real-device / visual 検証を実施済みとして記載していないか。

## 未決事項・リスク

### 決定事項

- WCAG 2.2 Level AA を既定基準とし、日本向けの補助基準として JIS X 8341-3:2016 Level AA を参照する。
- mobile viewport の必須最小値を 320px とし、375px、768px、1280px、200%/400% zoom を後続 UI task の共通 matrix にする。
- 自動 axe/visual test は品質 gate の一部であり、keyboard、screen reader、zoom/reflow、real-device の手動 evidence を代替しない。
- merge 済み #341〜#344 と canonical docs を正とし、削除済みの旧 `spec` / `spec-recovery` docs root を復活させない。

### 実装時確認

- 現行 E2E fixture で各 permission persona を安全に再現できる範囲。
- CI 実行時間を過度に増やさず必須化できる browser/viewport matrix。
- Playwright screenshot の OS/font 差を抑える既存 CI runtime の適合性。

### リスク

- Issue 全体は複数の production UI 領域にまたがるため、この task の完了を Issue #345 全体完了と誤認しない。
- trace manifest を手書きの重複一覧にすると stale source を増やすため、production source と canonical docs から検証可能な最小 authored metadata に限定する。
- requirement owner の承認や実機 screen reader evidence が必要な項目は、未検証のままチェックしない。
