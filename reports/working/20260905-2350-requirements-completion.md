# ステップ1–5の統合と運用費試算

- 状態: partially complete / 検証・運用受入継続
- 基準: main `8e542b31da137129927c1ea8d21650b0c0d483c8`
- 指示: 計画のステップ5まで対応し、運用費をPull Requestに明記する。
- task: `tasks/do/20260905-steps-one-through-five.md`

## 要件・判断

confirmed: 長期PRの競合を現mainに統合し、認可・signup・SQ-015費用優先の後続修正を保持する必要がある。#462を起点に#461/#464/#463/#458/#465の残差を目的別に統合した。#460と同じ問題に対するmainの後続修正を優先した。

## 実施した変更

| ステップ | 実装・確認 | 残る受入 |
| --- | --- | --- |
| 1 UI | skip link、keyboard、responsive、overflow、ARIA状態、3ブラウザのrequired gateを統合 | 最終headの3ブラウザ実走、manual screen reader/実機zoom |
| 2 履歴 | 欠落をv1として読む、v1/v2/v3受入・v3保存・unknown拒否・read時writeなし。summary、ticket、session contextを保持 | 最終CI |
| 3 認証・入口 | PKCE/state/nonce検証、CloudFront REST/WS、production execute-api無効、exact CORS、60秒単発WS ticket、session失効 | 実AWSでのDNS/証明書・Cognito・WS再接続・失効確認 |
| 4 共通部品・評価・監査 | shared/ui統一、TTFT実測根拠、faithfulness/contextRelevance根拠数と欠測null、artifact integrity。監査の対象別resolver/retry/quarantineと明示ID最大100件repair | 実障害を伴う運用訓練、監査保持方針のowner決定 |
| 5 責務・残機能・運用 | APIのagent/benchmark/favorite/question責務を分離。AppShell URL状態・DocumentWorkspace補助処理を分離。費用計算と未達ACを明示 | FR-050完成、FR-051永続化、残る大型controller分割、本番受入 |

## 未達を完了扱いしない事項

- FR-050: 既存provider adapterと再認可境界は存在するが、duplicate submit、cancel/commit race、resume、実workspace・writebackを含む完成した実行系ではない。feature permissionの未割当を変更して公開しない。`tasks/todo/20260713-2300-async-agent-execution.md`を継続する。
- FR-051: 個人設定は現状session-onlyの送信キーであり、本人に閉じた永続API/storeと通知・表示を含むruntime適用が未実装。`tasks/todo/20260713-2301-user-preferences.md`を継続する。
- OQ-UI-002: representative screen reader、実機、owner/cadenceの承認・実測は自動テストで代替しない。
- 監査保持期間: 365日Object Lock/400日expiryの旧案を自動採用しない。費用と消去可能性を含む運用方針の決定が残る。
- 実AWS deploy、請求取得、PR merge、既存PR closeは実施しない。

## 費用

`docs/4_運用_OPS/21_監視_MONITORING/OPS_OPERATING_COST_20260905.md`と`tools/operating-cost/estimate.mjs`に前提と再計算方法を記載。公開参考単価・無料枠控除なし・50%予備費・税別・1 USD=150円の仮定で、idle月2.38 USD、小規模1,000質問14.29 USD、中規模10,000質問87.67 USD。東京SKUの確定見積もりではなく上限でもない。モデル変更、ベンチマーク、外部provider、保持量増加は別途。実regionはdeployment側で確認が必要。

## 配備・回復手順

- GitHub Environment変数`MEMORAG_PUBLIC_ORIGIN`に実際のHTTPS frontend originを設定する。workflowは未設定やpath付きoriginをAWS変更前に拒否する。既定regionはus-east-1、dev配備のみを維持。
- production synth時は`corsAllowedOrigins`に加え、`restApiOriginDomainName`、`webSocketApiOriginDomainName`、`apiGatewayOriginCertificateArn`、`apiGatewayOriginHostedZoneId`、`apiGatewayOriginHostedZoneName`、品質通知先を明示する。DNS/証明書は実環境受入で確認する。
- `securityAuditBoundedRepairEnabled=true`を明示するとworker用read IAMとenv flagを有効化する。既定false、3 schedulesは常にdisabled。手動invokeには認可済みtenantIdと1–100件の重複のないintentIdsを渡す。全outbox列挙・完了履歴再走査を行わない。
- 戻す場合は同contextをfalseへ戻す。監査intentと既存履歴を消さない。履歴はread時書換えなしなので既存データの一括移行は不要。

## 検証証跡

- Web全体: 66files/472tests pass（最終UI補助処理分割前）。分割後はAppShell/DocumentWorkspace/historyの3files/89tests pass。
- 監査/history/benchmark API重点: 157tests pass。取消terminal保護・public contract・worker・bounded repair追加確認17tests pass。
- CDK snapshot更新時25tests pass。追加opt-in IAMを含む最終infra全体は確認中。
- Benchmark metrics重点32tests pass。全体では外部dataset fixture数の静的期待値が追加ケース分不足しており4件へ同期して再検証中。
- API全体初回1,035tests中29fail。起動時tsx IPC制限、生成文書、統合差分を修正。HTTP contractは`node --import tsx`起動で再実行中。初回failをpassとして扱わない。
- 最終lint/typecheck/build/docs/3ブラウザ/CI結果は追記する。

## Fit評価

ステップ1–4の統合実装とステップ5の責務分割・費用試算を作成した。ただしFR-050/FR-051と実環境受入を残しているため「ステップ5まで全完了」という依頼には未達。PRはDraft、taskはdoに置き、未達を分かる状態にする。
