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

| コンポーネント | 役割 | ファイル | export | 使用 JSX 要素 |
| --- | --- | --- | --- | --- |
| BenchmarkWorkspace | 画面または画面内 UI コンポーネント | apps/web/src/features/benchmark/components/BenchmarkWorkspace.tsx | BenchmarkWorkspace | BenchmarkMetricCard, BenchmarkMetricChips, Icon, LoadingSpinner, LoadingStatus, article, button, code, div, h2, h3, header, input, label, option, p, section, select, small, span, strong, table, tbody, td, th, thead, tr |

## 主なボタン・リンク

| コンポーネント | 要素 | ラベル | アクセシブル名 | 状態 | a11y | ハンドラ | 場所 | 確度 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| BenchmarkWorkspace | button | チャットへ戻る | チャットへ戻る (aria-label) | - | ok: 日本語のアクセシブル名または表示テキストを確認できます。 | onClick=onBack | apps/web/src/features/benchmark/components/BenchmarkWorkspace.tsx:57 | confirmed |
| BenchmarkWorkspace | button | loading ? <LoadingSpinner className="button-spinner" /> : <Icon name="send" /> … | loading ? <LoadingSpinner className="button-spinner" /> : <Icon name="send" /> / 性能テストを実行 (visible-text) | disabled=loading \|\| !canRun | ok: 日本語のアクセシブル名または表示テキストを確認できます。 | onClick=onStart | apps/web/src/features/benchmark/components/BenchmarkWorkspace.tsx:127 | confirmed |
| BenchmarkWorkspace | button | loading ? <LoadingSpinner className="button-spinner" /> : <Icon name="clock" />… | loading ? <LoadingSpinner className="button-spinner" /> : <Icon name="clock" /> / 更新 (visible-text) | disabled=loading | ok: 日本語のアクセシブル名または表示テキストを確認できます。 | onClick=onRefresh | apps/web/src/features/benchmark/components/BenchmarkWorkspace.tsx:131 | confirmed |
| BenchmarkWorkspace | button | `${artifact.description}をダウンロード` | `${artifact.description}をダウンロード` (aria-label) | disabled=!canDownload \|\| !canDownloadArtifact(run, artifact.kind) | ok: 日本語のアクセシブル名または表示テキストを確認できます。 | onClick=() => void downloadBenchmarkArtifact(run.runId, artifact.kind) | apps/web/src/features/benchmark/components/BenchmarkWorkspace.tsx:183 | confirmed |
| BenchmarkWorkspace | button | `${run.runId}のジョブをキャンセル` | `${run.runId}のジョブをキャンセル` (aria-label) | disabled=!canCancel \|\| loading \|\| !["queued", "running"].includes(run.status) | ok: 日本語のアクセシブル名または表示テキストを確認できます。 | onClick=() => void onCancel(run.runId) | apps/web/src/features/benchmark/components/BenchmarkWorkspace.tsx:195 | confirmed |

## フォーム

フォームは静的解析では見つかりませんでした。

## 入力項目

| コンポーネント | 要素 | ラベル | アクセシブル名 | 説明参照 | 状態 | a11y | ハンドラ | 場所 | 確度 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| BenchmarkWorkspace | select | suiteId | suites.length === 0 && <option value={suiteId}>standard-agent-v1</option> / suites.map((suite) => ( <option value={suit… (visible-text) | - | - | ok: 日本語のアクセシブル名または表示テキストを確認できます。 | onChange=(event) => onSuiteChange(event.target.value) | apps/web/src/features/benchmark/components/BenchmarkWorkspace.tsx:85 | confirmed |
| BenchmarkWorkspace | input | selectedSuite?.datasetS3Key ?? "datasets/agent/standard-v1.jsonl" | データセット (label) | - | - | ok: 日本語のアクセシブル名または表示テキストを確認できます。 | - | apps/web/src/features/benchmark/components/BenchmarkWorkspace.tsx:106 | confirmed |
| BenchmarkWorkspace | select | modelId | Nova Lite v1 / Claude 3.5 Sonnet / Claude 3 Haiku (visible-text) | - | - | ok: 日本語のアクセシブル名または表示テキストを確認できます。 | onChange=(event) => onModelChange(event.target.value) | apps/web/src/features/benchmark/components/BenchmarkWorkspace.tsx:110 | confirmed |
| BenchmarkWorkspace | input | concurrency | 並列数 (label) | - | - | ok: 日本語のアクセシブル名または表示テキストを確認できます。 | onChange=(event) => onConcurrencyChange(Math.max(1, Math.min(20, Number(event.target.value) \|\| 1))) | apps/web/src/features/benchmark/components/BenchmarkWorkspace.tsx:118 | confirmed |

## UI 操作要素の全量

| コンポーネント | 要素 | ラベル | アクセシブル名 | 状態 | a11y | ハンドラ | 場所 | 確度 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| BenchmarkWorkspace | button | チャットへ戻る | チャットへ戻る (aria-label) | - | ok: 日本語のアクセシブル名または表示テキストを確認できます。 | onClick=onBack | apps/web/src/features/benchmark/components/BenchmarkWorkspace.tsx:57 | confirmed |
| BenchmarkWorkspace | label | テスト種別 / suites.length === 0 && <option value={suiteId}>standard-agent-v1</optio… | テスト種別 / suites.length === 0 && <option value={suiteId}>standard-agent-v1</option> / suites.map((suite) => ( <option val… (visible-text) | - | ok: 日本語のアクセシブル名または表示テキストを確認できます。 | - | apps/web/src/features/benchmark/components/BenchmarkWorkspace.tsx:83 | confirmed |
| BenchmarkWorkspace | select | suiteId | suites.length === 0 && <option value={suiteId}>standard-agent-v1</option> / suites.map((suite) => ( <option value={suit… (visible-text) | - | ok: 日本語のアクセシブル名または表示テキストを確認できます。 | onChange=(event) => onSuiteChange(event.target.value) | apps/web/src/features/benchmark/components/BenchmarkWorkspace.tsx:85 | confirmed |
| BenchmarkWorkspace | option | suiteId | standard-agent-v1 (visible-text) | - | ok: 日本語のアクセシブル名または表示テキストを確認できます。 | - | apps/web/src/features/benchmark/components/BenchmarkWorkspace.tsx:86 | confirmed |
| BenchmarkWorkspace | option | suite.suiteId | suite.label (visible-text) | - | ok: 日本語のアクセシブル名または表示テキストを確認できます。 | - | apps/web/src/features/benchmark/components/BenchmarkWorkspace.tsx:88 | confirmed |
| BenchmarkWorkspace | label | データセット | データセット (visible-text) | - | ok: 日本語のアクセシブル名または表示テキストを確認できます。 | - | apps/web/src/features/benchmark/components/BenchmarkWorkspace.tsx:104 | confirmed |
| BenchmarkWorkspace | input | selectedSuite?.datasetS3Key ?? "datasets/agent/standard-v1.jsonl" | データセット (label) | - | ok: 日本語のアクセシブル名または表示テキストを確認できます。 | - | apps/web/src/features/benchmark/components/BenchmarkWorkspace.tsx:106 | confirmed |
| BenchmarkWorkspace | label | モデル / Nova Lite v1 / Claude 3.5 Sonnet / Claude 3 Haiku | モデル / Nova Lite v1 / Claude 3.5 Sonnet / Claude 3 Haiku (visible-text) | - | ok: 日本語のアクセシブル名または表示テキストを確認できます。 | - | apps/web/src/features/benchmark/components/BenchmarkWorkspace.tsx:108 | confirmed |
| BenchmarkWorkspace | select | modelId | Nova Lite v1 / Claude 3.5 Sonnet / Claude 3 Haiku (visible-text) | - | ok: 日本語のアクセシブル名または表示テキストを確認できます。 | onChange=(event) => onModelChange(event.target.value) | apps/web/src/features/benchmark/components/BenchmarkWorkspace.tsx:110 | confirmed |
| BenchmarkWorkspace | option | amazon.nova-lite-v1:0 | Nova Lite v1 (visible-text) | - | ok: 日本語のアクセシブル名または表示テキストを確認できます。 | - | apps/web/src/features/benchmark/components/BenchmarkWorkspace.tsx:111 | confirmed |
| BenchmarkWorkspace | option | anthropic.claude-3-5-sonnet-20240620-v1:0 | Claude 3.5 Sonnet (visible-text) | - | ok: 日本語のアクセシブル名または表示テキストを確認できます。 | - | apps/web/src/features/benchmark/components/BenchmarkWorkspace.tsx:112 | confirmed |
| BenchmarkWorkspace | option | anthropic.claude-3-haiku-20240307-v1:0 | Claude 3 Haiku (visible-text) | - | ok: 日本語のアクセシブル名または表示テキストを確認できます。 | - | apps/web/src/features/benchmark/components/BenchmarkWorkspace.tsx:113 | confirmed |
| BenchmarkWorkspace | label | 並列数 | 並列数 (visible-text) | - | ok: 日本語のアクセシブル名または表示テキストを確認できます。 | - | apps/web/src/features/benchmark/components/BenchmarkWorkspace.tsx:116 | confirmed |
| BenchmarkWorkspace | input | concurrency | 並列数 (label) | - | ok: 日本語のアクセシブル名または表示テキストを確認できます。 | onChange=(event) => onConcurrencyChange(Math.max(1, Math.min(20, Number(event.target.value) \|\| 1))) | apps/web/src/features/benchmark/components/BenchmarkWorkspace.tsx:118 | confirmed |
| BenchmarkWorkspace | button | loading ? <LoadingSpinner className="button-spinner" /> : <Icon name="send" /> … | loading ? <LoadingSpinner className="button-spinner" /> : <Icon name="send" /> / 性能テストを実行 (visible-text) | disabled=loading \|\| !canRun | ok: 日本語のアクセシブル名または表示テキストを確認できます。 | onClick=onStart | apps/web/src/features/benchmark/components/BenchmarkWorkspace.tsx:127 | confirmed |
| BenchmarkWorkspace | button | loading ? <LoadingSpinner className="button-spinner" /> : <Icon name="clock" />… | loading ? <LoadingSpinner className="button-spinner" /> : <Icon name="clock" /> / 更新 (visible-text) | disabled=loading | ok: 日本語のアクセシブル名または表示テキストを確認できます。 | onClick=onRefresh | apps/web/src/features/benchmark/components/BenchmarkWorkspace.tsx:131 | confirmed |
| BenchmarkWorkspace | button | `${artifact.description}をダウンロード` | `${artifact.description}をダウンロード` (aria-label) | disabled=!canDownload \|\| !canDownloadArtifact(run, artifact.kind) | ok: 日本語のアクセシブル名または表示テキストを確認できます。 | onClick=() => void downloadBenchmarkArtifact(run.runId, artifact.kind) | apps/web/src/features/benchmark/components/BenchmarkWorkspace.tsx:183 | confirmed |
| BenchmarkWorkspace | button | `${run.runId}のジョブをキャンセル` | `${run.runId}のジョブをキャンセル` (aria-label) | disabled=!canCancel \|\| loading \|\| !["queued", "running"].includes(run.status) | ok: 日本語のアクセシブル名または表示テキストを確認できます。 | onClick=() => void onCancel(run.runId) | apps/web/src/features/benchmark/components/BenchmarkWorkspace.tsx:195 | confirmed |
