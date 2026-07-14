# REQ-AUI-013: usage/cost 経路の制御された移行

## 要件

システムは、usage/costの新しいread/write経路を、tenant分離されたmigration、dual-read比較、live canary、rollback gateを通過した後にだけ既定経路へ切り替えなければならない。

## 要求属性

- 識別子: `REQ-AUI-013`
- 説明: PR #339相当candidateを現行mainへ再適合し、欠落・二重計上・tenant混在・価格誤適用を監視してcutoverする
- 根拠: candidateは有力だがScan上限、tenant固定、wildcard価格、live AWS未検証が残る
- 源泉: `FACT-AUI-077`–`081`; PR #339 とcandidate reports
- Actor / trigger: migration/backfill、rollout gate、canary、rollback、legacy停止
- 種類: operational / migration / reliability / security
- 依存関係: `REQ-AUI-001`–`003`, `REQ-AUI-008`, `REQ-AUI-009`、rollout owner
- 衝突:未マージcandidate、current mainとの差分、旧ledger summary
- 受け入れ基準: `AC-AUI-147`–`158`
- 優先度: P0 rollout
- 安定性: gate原則はstable、許容差/期間/ownerはopen_question
- Confidence: confirmed candidate / open_question
- 所有者: Platform / Ops / FinOps / Security
- 変更履歴: 2026-07-13 proposed

## 受け入れ条件

- `AC-AUI-147`:1,000件超でも無言の集計欠落を生じない。
- `AC-AUI-148`: migration/readでtenantを混在させない。
- `AC-AUI-151`: migration再実行で二重計上しない。
- `AC-AUI-153`:比較差分が許容差を超えたらcutoverを停止する。
- `AC-AUI-154`: live provider/storage/exportをend-to-endで追跡する。
- `AC-AUI-156`:障害時にデータを壊さずrollbackする。

## 妥当性確認

- 必要性:未マージcandidateを「実装済み」と誤認せず安全に再利用する
- 十分性: scale/tenant/pricing/migration/comparison/live/security/rollback/reconciliationを含む
- 一貫性: new pathが要件を満たすまでlegacy停止を許さない
- 実現可能性: index追加、idempotent migration、feature flag/canaryで段階化できる
- 検証可能性:load/migration/security/live canary/rollback evidenceでgate判定する

## トレース

- Task: `TASK-AUI-013`
- E2E: `E2E-AUI-016`, `E2E-AUI-017`
- Gap: `GAP-AUI-008`, `GAP-AUI-030`, `GAP-AUI-035`
- Specification: `SPEC-AUI-013`
