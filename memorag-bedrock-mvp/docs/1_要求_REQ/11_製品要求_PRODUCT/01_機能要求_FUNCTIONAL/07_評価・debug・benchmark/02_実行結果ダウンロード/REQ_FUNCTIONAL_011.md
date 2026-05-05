# 要件定義（1要件1ファイル）

- 要件ID: `FR-011`
- 種別: `REQ_FUNCTIONAL`
- 状態: Draft

## 分類（L0-L3）

- L0: `rag-assist / MemoRAG MVP 機能要件`
- L1主分類: `7. 評価・debug・benchmark`
- L2主機能群: `7.2 実行結果ダウンロード`
- L3要件: `FR-011`
- 関連カテゴリ: なし

## 要件

- FR-011: 実行結果の詳細をダウンロードできること。

## 受け入れ条件（この要件専用）

- AC-006: 実行履歴の一覧表示と詳細表示が成功すること。
- AC-FR011-002: 性能テストの成果物として、Markdown report、summary JSON、Raw results JSONL の download URL を取得できること。
- AC-FR011-003: 管理画面の性能テスト履歴から、権限を持つ利用者が report、summary JSON、Raw results を個別にダウンロードできること。

## 要件の源泉・背景

- 源泉: 旧 `memorag-bedrock-mvp/docs/REQUIREMENTS.md` に定義された原子要件を分割移管。
- 背景: 要求単位で差分レビュー・追跡・変更管理をしやすくするため、1要件1ファイル運用へ移行。

## 要件の目的・意図

- 目的: 実行結果を外部共有・二次分析できる形で持ち出せるようにする。
- 意図: 画面内閲覧だけでなく検証資産として再利用可能にする。
- 区分: 機能要求として管理し、関連要件と独立に改訂可能な単位を維持する。

## 補足

- Raw results は `results.jsonl` を指し、benchmark dataset の各行に対する入力、応答、評価結果、失敗理由を再分析するために利用する。
