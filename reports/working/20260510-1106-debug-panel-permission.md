# 作業完了レポート

保存先: `reports/working/20260510-1106-debug-panel-permission.md`

## 1. 受けた指示

- 主な依頼: デバッグパネルを権限を持つ人のみ利用可能にし、権限がない人には非表示にする。
- 成果物: Web UI 表示制御、権限制御テスト、task md、作業レポート。
- 形式・条件: worktree/task/PR flow、権限境界レビュー、no-mock product UI、検証ルールに従う。

## 2. 要件整理

| 要件ID | 指示・要件 | 重要度 | 対応状況 |
|---|---|---:|---|
| R1 | 権限ありユーザーだけ `DebugPanel` を表示する | 高 | 対応 |
| R2 | 権限なしユーザーでは `DebugPanel` を非表示にする | 高 | 対応 |
| R3 | 権限なしユーザーに debug trace / retrieved full text / internal metadata を表示しない | 高 | 対応 |
| R4 | 権限制御に mock fallback や固定ユーザーを追加しない | 高 | 対応 |
| R5 | 対象挙動をテストで確認する | 高 | 対応 |
| R6 | API route / server-side RBAC 変更要否を判断する | 高 | 対応 |

## 3. 検討・判断したこと

- 既存 Web permission model では `canReadDebugRuns` が `chat:admin:read_all` から派生しており、`/debug-runs` API と同じ管理系 permission に対応しているため、この既存 permission を採用した。
- `TopBar` の debug toggle、debug run 初期取得、chat request の `includeDebug` は既に `canReadDebugRuns` で制御されていた。
- `ChatView` では `DebugPanel` 自体は `debugMode && canReadDebugRuns` で制御されていたが、layout class は `debugMode` のみを見ていたため、権限なしで debug mode が残った場合も `debug-off` になるよう表示判定を一元化した。
- API route / server-side RBAC は既に `/debug-runs` と debug include 取得側で permission を要求しており、今回の依頼は UI 非表示制御の強化で足りると判断した。
- 本番経路に fake user、fake role、固定権限 fallback は追加していない。テスト fixture の `CHAT_USER` / `SYSTEM_ADMIN` は既存 role permission map を使っている。

## 4. 実施した作業

- `ChatView` に `canShowDebugPanel = debugMode && canReadDebugRuns` を追加し、layout class と `DebugPanel` render 条件を同一条件へ統一した。
- `ChatView.test.tsx` を追加し、権限ありでは `DebugPanel` が表示され、権限なしでは `DebugPanel` が DOM に出ず `debug-off` layout になることを確認した。
- `App.test.tsx` に `CHAT_USER` の統合テストを追加し、debug toggle 非表示、`DebugPanel` 非表示、`/debug-runs` 未取得、chat request の `includeDebug: false` を確認した。

## 5. 成果物

| 成果物 | 形式 | 内容 | 指示との対応 |
|---|---|---|---|
| `memorag-bedrock-mvp/apps/web/src/features/chat/components/ChatView.tsx` | TypeScript/React | debug panel 表示判定と layout 判定の一元化 | R1-R3 |
| `memorag-bedrock-mvp/apps/web/src/features/chat/components/ChatView.test.tsx` | Vitest | 権限あり/なしの直接テスト | R1-R5 |
| `memorag-bedrock-mvp/apps/web/src/App.test.tsx` | Vitest | `CHAT_USER` で debug UI/API が露出しない統合テスト | R2-R5 |
| `tasks/done/20260510-1102-debug-panel-permission.md` | Markdown | 受け入れ条件付き task md | workflow |

## 6. 指示への fit 評価

| 評価軸 | 評価 | 理由 |
|---|---|---|
| 指示網羅性 | 5 | 権限あり/なし双方の表示条件を実装・検証した。 |
| 制約遵守 | 5 | 既存 permission と no-mock 方針を使い、API 権限境界は弱めていない。 |
| 成果物品質 | 4 | 対象テスト、typecheck、docs check は通過。実ブラウザ screenshot は未実施。 |
| 説明責任 | 5 | API/RBAC を変更しない理由と未実施項目を記録した。 |
| 検収容易性 | 5 | 成果物と検証コマンドを明示した。 |

総合fit: 4.8 / 5.0（約96%）
理由: 主要要件は満たした。実ブラウザでの視覚確認は未実施のため満点ではない。

## 7. 実行した検証

- `npm ci`: pass。検証用依存関係を展開した。既存依存に `npm audit` の 3 vulnerabilities が報告されたが、今回の修正範囲外。
- `npm --prefix memorag-bedrock-mvp run test -w @memorag-mvp/web -- ChatView.test.tsx App.test.tsx`: pass
- `npm --prefix memorag-bedrock-mvp run typecheck -w @memorag-mvp/web`: pass
- `npm --prefix memorag-bedrock-mvp run docs:web-inventory:check`: pass
- `git diff --check`: pass

## 8. 未対応・制約・リスク

- 実ブラウザ visual regression / screenshot は未実施。今回の変更は権限条件と DOM 表示制御であり、対象コンポーネントテスト、統合テスト、typecheck で最小十分と判断した。
- `npm audit fix` は未実施。依存更新は今回の UI 権限制御と目的が異なるため。
- API route / server-side RBAC は変更していない。既存の `chat:admin:read_all` 境界を Web UI 側でも使う変更であり、サーバー側の permission を弱めていない。
