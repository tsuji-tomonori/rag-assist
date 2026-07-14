# 概要

<!-- PR タイトルとコメント本文は日本語で記載してください。 -->

## 変更内容

<!-- 変更した主な内容を箇条書きで記載してください。 -->

## 背景・目的

<!-- なぜこの変更が必要かを記載してください。 -->


## リリース種別

- [ ] semver:major（破壊的変更）
- [ ] semver:minor（後方互換のある機能追加）
- [ ] semver:patch（後方互換のある修正）

<!-- GitHub ラベルでも同じ semver:* を必ず 1 つ付与してください。 -->

## 確認内容

- [ ] 動作確認を実施した
- [ ] テストを実行した
- [ ] ドキュメントや設定の更新が必要ないことを確認した

## UI 変更の品質証跡

<!-- production Web UI、共通 UI、CSS、UI test/CI、UI 正規文書を変更した場合に記載してください。非該当項目は理由を記載してください。 -->

- 対象 AppView / persona / 主要 job:
- 変更前の問題と変更後の behavior:
- 状態網羅（loading / empty / error / permission / partial / stale / retry）:
- responsive（320 / 375 / 768 / 1280px、200% / 400% zoom）:
- accessibility（name / role / state、keyboard、focus、contrast、target、screen reader、reduced motion）:
- 正規要件・AC・UI design と generated inventory の同期:
- unit / E2E / visual / axe / manual / real-device の実施結果:
- 未実施・blocked・skipped の検証、その理由と残余リスク:

- [ ] UI 意味トレースと generated inventory を更新または非該当と判断した
- [ ] permission UI が API authorization を代替せず、権限外 data を取得・表示しないことを確認した
- [ ] API/props/state/config にない値を production UI の demo fallback として追加していない

## 影響範囲

<!-- 画面、API、運用、CI、ドキュメントなどへの影響を記載してください。 -->

## 補足

<!-- レビュー時に見てほしい点、未対応事項、既知の制約があれば記載してください。 -->
