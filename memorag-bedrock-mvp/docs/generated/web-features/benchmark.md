# Web 機能詳細: 性能テスト

> 自動生成: `tools/web-inventory/generate-web-inventory.mjs`
>
> 静的解析による推定を含みます。条件付き表示、権限別表示、実行時データ依存の UI は certainty を確認してください。
>
> 読み方: `confirmed` はコードから直接確認できた情報、`inferred` は fallback や構造から推定した情報、`unknown` は静的解析だけでは断定できない情報です。


## 概要

ベンチマーク suite の選択、run 起動、履歴、成果物ダウンロードを扱う領域です。

## 関連画面

| 表示名 | view | 画面コンポーネント | 権限条件 | 説明 |
| --- | --- | --- | --- | --- |
| 性能テスト | benchmark | BenchmarkWorkspace | canReadBenchmarkRuns | 性能テスト。benchmark suite を選択し、run 起動、キャンセル、結果 download を行います。 |

## コンポーネント

| コンポーネント | 説明 | 役割 | ファイル | export | 使用 JSX 要素 |
| --- | --- | --- | --- | --- | --- |
| BenchmarkWorkspace | BenchmarkWorkspace は 性能テスト 領域の 画面または画面内 UI コンポーネント です。関連画面: 性能テスト。 | 画面または画面内 UI コンポーネント | apps/web/src/features/benchmark/components/BenchmarkWorkspace.tsx | BenchmarkWorkspace | BenchmarkMetricCard, BenchmarkMetricChips, ConfirmDialog, Icon, LoadingSpinner, LoadingStatus, article, button, code, div, h2, h3, header, input, label, option, p, section, select, small, span, strong, table, tbody, td, th, thead, tr |

## 主なボタン・リンク

| コンポーネント | 要素 | ラベル | 操作説明 | 状態・補足 | ハンドラ | 場所 | 確度 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| BenchmarkWorkspace | button | チャットへ戻る | 「チャットへ戻る」を実行するボタン。 | - | onClick=onBack | apps/web/src/features/benchmark/components/BenchmarkWorkspace.tsx:61 | confirmed |
| BenchmarkWorkspace | button | 性能テストを実行 | 「性能テストを実行」を実行するボタン。 | 状態: disabled=loading \|\| !canRun \|\| !selectedSuite | onClick=() => setConfirmStartOpen(true) | apps/web/src/features/benchmark/components/BenchmarkWorkspace.tsx:131 | confirmed |
| BenchmarkWorkspace | button | 更新 | 「更新」を実行するボタン。 | 状態: disabled=loading | onClick=onRefresh | apps/web/src/features/benchmark/components/BenchmarkWorkspace.tsx:135 | confirmed |
| BenchmarkWorkspace | button | `${artifact.description}をダウンロード` | 「`${artifact.description}をダウンロード`」を実行するボタン。 | 状態: disabled=!canDownload \|\| !canDownloadArtifact(run, artifact.kind) | onClick=() => void downloadBenchmarkArtifact(run.runId, artifact.kind) | apps/web/src/features/benchmark/components/BenchmarkWorkspace.tsx:187 | confirmed |
| BenchmarkWorkspace | button | `${run.runId}のジョブをキャンセル` | 「`${run.runId}のジョブをキャンセル`」を実行するボタン。 | 状態: disabled=!canCancel \|\| loading \|\| !["queued", "running"].includes(run.status) | onClick=() => void onCancel(run.runId) | apps/web/src/features/benchmark/components/BenchmarkWorkspace.tsx:199 | confirmed |

## フォーム

フォームは静的解析では見つかりませんでした。

## 入力項目

| コンポーネント | 要素 | ラベル | 入力項目の説明 | 状態・補足 | ハンドラ | 場所 | 確度 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| BenchmarkWorkspace | select | テスト種別 | 「テスト種別」を選ぶ選択項目。 | 状態: disabled=!hasSuites | onChange=(event) => onSuiteChange(event.target.value) | apps/web/src/features/benchmark/components/BenchmarkWorkspace.tsx:89 | confirmed |
| BenchmarkWorkspace | input | データセット | 「データセット」を入力または選択する項目。 | - | - | apps/web/src/features/benchmark/components/BenchmarkWorkspace.tsx:110 | confirmed |
| BenchmarkWorkspace | select | Nova Lite v1 / Claude 3.5 Sonnet / Claude 3 Haiku | 「Nova Lite v1 / Claude 3.5 Sonnet / Claude 3 Haiku」を選ぶ選択項目。 | - | onChange=(event) => onModelChange(event.target.value) | apps/web/src/features/benchmark/components/BenchmarkWorkspace.tsx:114 | confirmed |
| BenchmarkWorkspace | input | 並列数 | 「並列数」を入力または選択する項目。 | - | onChange=(event) => onConcurrencyChange(Math.max(1, Math.min(20, Number(event.target.value) \|\| 1))) | apps/web/src/features/benchmark/components/BenchmarkWorkspace.tsx:122 | confirmed |

## UI 操作要素の全量

| コンポーネント | 要素 | ラベル | UI 説明 | 状態・補足 | ハンドラ | 場所 | 確度 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| BenchmarkWorkspace | button | チャットへ戻る | 「チャットへ戻る」を実行するボタン。 | - | onClick=onBack | apps/web/src/features/benchmark/components/BenchmarkWorkspace.tsx:61 | confirmed |
| BenchmarkWorkspace | label | テスト種別 | 「テスト種別」に紐づく入力ラベル。 | - | - | apps/web/src/features/benchmark/components/BenchmarkWorkspace.tsx:87 | confirmed |
| BenchmarkWorkspace | select | テスト種別 | 「テスト種別」を選ぶ選択項目。 | 状態: disabled=!hasSuites | onChange=(event) => onSuiteChange(event.target.value) | apps/web/src/features/benchmark/components/BenchmarkWorkspace.tsx:89 | confirmed |
| BenchmarkWorkspace | option | benchmark suite を取得できません | 「benchmark suite を取得できません」を表す option 要素。 | - | - | apps/web/src/features/benchmark/components/BenchmarkWorkspace.tsx:90 | confirmed |
| BenchmarkWorkspace | option | テスト種別 | 「テスト種別」を表す option 要素。 | - | - | apps/web/src/features/benchmark/components/BenchmarkWorkspace.tsx:92 | confirmed |
| BenchmarkWorkspace | label | データセット | 「データセット」に紐づく入力ラベル。 | - | - | apps/web/src/features/benchmark/components/BenchmarkWorkspace.tsx:108 | confirmed |
| BenchmarkWorkspace | input | データセット | 「データセット」を入力または選択する項目。 | - | - | apps/web/src/features/benchmark/components/BenchmarkWorkspace.tsx:110 | confirmed |
| BenchmarkWorkspace | label | モデル / Nova Lite v1 / Claude 3.5 Sonnet / Claude 3 Haiku | 「モデル / Nova Lite v1 / Claude 3.5 Sonnet / Claude 3 Haiku」に紐づく入力ラベル。 | - | - | apps/web/src/features/benchmark/components/BenchmarkWorkspace.tsx:112 | confirmed |
| BenchmarkWorkspace | select | Nova Lite v1 / Claude 3.5 Sonnet / Claude 3 Haiku | 「Nova Lite v1 / Claude 3.5 Sonnet / Claude 3 Haiku」を選ぶ選択項目。 | - | onChange=(event) => onModelChange(event.target.value) | apps/web/src/features/benchmark/components/BenchmarkWorkspace.tsx:114 | confirmed |
| BenchmarkWorkspace | option | Nova Lite v1 | 「Nova Lite v1」を表す option 要素。 | - | - | apps/web/src/features/benchmark/components/BenchmarkWorkspace.tsx:115 | confirmed |
| BenchmarkWorkspace | option | Claude 3.5 Sonnet | 「Claude 3.5 Sonnet」を表す option 要素。 | - | - | apps/web/src/features/benchmark/components/BenchmarkWorkspace.tsx:116 | confirmed |
| BenchmarkWorkspace | option | Claude 3 Haiku | 「Claude 3 Haiku」を表す option 要素。 | - | - | apps/web/src/features/benchmark/components/BenchmarkWorkspace.tsx:117 | confirmed |
| BenchmarkWorkspace | label | 並列数 | 「並列数」に紐づく入力ラベル。 | - | - | apps/web/src/features/benchmark/components/BenchmarkWorkspace.tsx:120 | confirmed |
| BenchmarkWorkspace | input | 並列数 | 「並列数」を入力または選択する項目。 | - | onChange=(event) => onConcurrencyChange(Math.max(1, Math.min(20, Number(event.target.value) \|\| 1))) | apps/web/src/features/benchmark/components/BenchmarkWorkspace.tsx:122 | confirmed |
| BenchmarkWorkspace | button | 性能テストを実行 | 「性能テストを実行」を実行するボタン。 | 状態: disabled=loading \|\| !canRun \|\| !selectedSuite | onClick=() => setConfirmStartOpen(true) | apps/web/src/features/benchmark/components/BenchmarkWorkspace.tsx:131 | confirmed |
| BenchmarkWorkspace | button | 更新 | 「更新」を実行するボタン。 | 状態: disabled=loading | onClick=onRefresh | apps/web/src/features/benchmark/components/BenchmarkWorkspace.tsx:135 | confirmed |
| BenchmarkWorkspace | button | `${artifact.description}をダウンロード` | 「`${artifact.description}をダウンロード`」を実行するボタン。 | 状態: disabled=!canDownload \|\| !canDownloadArtifact(run, artifact.kind) | onClick=() => void downloadBenchmarkArtifact(run.runId, artifact.kind) | apps/web/src/features/benchmark/components/BenchmarkWorkspace.tsx:187 | confirmed |
| BenchmarkWorkspace | button | `${run.runId}のジョブをキャンセル` | 「`${run.runId}のジョブをキャンセル`」を実行するボタン。 | 状態: disabled=!canCancel \|\| loading \|\| !["queued", "running"].includes(run.status) | onClick=() => void onCancel(run.runId) | apps/web/src/features/benchmark/components/BenchmarkWorkspace.tsx:199 | confirmed |
