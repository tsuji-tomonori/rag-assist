# 要件対応ステップ1–5と運用費

- 状態: in_progress
- タスク種別: 修正
- 基準: main 8e542b31
- 依頼: 計画のステップ5まで対応し、運用費をPRに明記する。

## 原因・対応

confirmed: 長期PRの未収束、履歴version世代差、wildcard CORS、UI検証失敗が残る。現mainの認可・signup・cost-priorityを保持して、#462/#461/#464/#463/#458/#465の残差を収束する。

## 受け入れ条件

- [ ] UIを3ブラウザで検証し実overflow検出を保持
- [ ] 履歴欠落/v1/v2/v3 read、v3 write、情報保持、unknown拒否、read時writeなし
- [ ] CloudFront単一入口・PKCE・CORS・WSチケットの認可境界を検証
- [ ] 共通UI・評価指標・監査の契約を収束
- [ ] 責務分割・残機能・運用受入をAC単位で評価
- [ ] SQ-015の定期scan無効を保持
- [ ] 正本と生成文書を同期しCI相当を検証
- [ ] AWS利用量・単価・固定/変動費・無料枠・税・為替を明示
- [ ] PR作成、受入確認・セルフレビューを記載

## 検証計画

targeted contract/API/Web/infra/benchmark → 全体CI/docs/3-browser E2E。実AWS・実機・owner判断を未実施のままpassにしない。

## 復旧

作業ディレクトリ消失後、専用cloneへ既存PR差分を再適用。失われたローカルcommitを実装復元し再検証する。検証ログは/tmpに残存。
