# 作業完了レポート

保存先: `reports/working/20260501-0136-e2e-test-foundation.md`

## 1. 受けた指示

- `memorag-bedrock-mvp/apps/web` に Playwright ベースの E2E テスト基盤を追加する。
- ローカル API（`@memorag-mvp/api`）を起動し、実通信で検証する。
- 最小シナリオとして、アップロード反映、回答＋citiations、根拠不足時 no-answer、削除後挙動変化を実装する。
- CI は smoke（1〜2シナリオ）と nightly（詳細シナリオ）に分離する。

## 2. 要件整理

| 要件ID | 指示・要件 | 重要度 | 対応状況 |
|---|---|---:|---|
| R1 | Playwright 基盤の追加 | 高 | 対応 |
| R2 | API と Web を同時起動して実通信テスト | 高 | 対応 |
| R3 | 4シナリオの実装 | 高 | 対応 |
| R4 | CI で smoke/nightly 分離 | 高 | 対応 |

## 3. 検討・判断したこと

- E2E 実通信を最小構成で実現するため、Playwright の `webServer` で API と Web を起動する方式を採用した。
- CI の短時間化要件に合わせて、`@smoke` タグで 2 シナリオを抽出し、残りは full 実行に残した。
- API の外部依存を避けるため、E2E 実行時は `MOCK_BEDROCK=1` と local store を有効化した。

## 4. 実施した作業

- `playwright.config.ts` を追加し、シナリオ別 grep と webServer 設定を実装。
- `e2e/chat-document-flow.spec.ts` を追加し、4 シナリオを実装。
- `apps/web/package.json` に E2E 実行 scripts と `@playwright/test` を追加。
- `.github/workflows/e2e.yml` を追加し、PR 時 smoke、schedule/workflow_dispatch 時 nightly を実行するようにした。

## 5. 成果物

| 成果物 | 形式 | 内容 | 指示との対応 |
|---|---|---|---|
| `memorag-bedrock-mvp/apps/web/playwright.config.ts` | TS | Playwright 設定（実通信 webServer 含む） | R1, R2 |
| `memorag-bedrock-mvp/apps/web/e2e/chat-document-flow.spec.ts` | TS | 4 シナリオ E2E テスト | R3 |
| `memorag-bedrock-mvp/apps/web/package.json` | JSON | E2E scripts / dependency 追加 | R1 |
| `memorag-bedrock-mvp/.github/workflows/e2e.yml` | YAML | smoke/nightly 分離 CI | R4 |

## 6. 指示へのfit評価

| 評価軸 | 評価 | 理由 |
|---|---:|---|
| 指示網羅性 | 5/5 | 4シナリオ + CI 分離を実装 |
| 制約遵守 | 4/5 | 指定内容に沿って実装、ただしローカル環境でブラウザ取得制約あり |
| 成果物品質 | 4/5 | 最小実装として十分、今後 test-id 追加で安定化余地あり |
| 説明責任 | 5/5 | 制約・未検証事項を明示 |
| 検収容易性 | 5/5 | ファイル単位で確認可能 |

**総合fit: 4.6/5（約92%）**

理由: 要求された構成とシナリオは実装できたが、この環境では Playwright のブラウザ取得が 403 で失敗しローカル実行完了まで未達。

## 7. 未対応・制約・リスク

- 未対応: 実ブラウザでの全シナリオ完走確認（環境制約により未完了）。
- 制約: `npx playwright install chromium` が CDN 403（Domain forbidden）で失敗。
- リスク: CI 側で同様に外部アクセス制限がある場合、ブラウザインストール手順のミラー設定が必要。

## 8. 次に改善できること

- 主要 UI に `data-testid` を追加し、セレクタの堅牢性を向上。
- smoke の所要時間計測後、並列度・タグ戦略を調整。
