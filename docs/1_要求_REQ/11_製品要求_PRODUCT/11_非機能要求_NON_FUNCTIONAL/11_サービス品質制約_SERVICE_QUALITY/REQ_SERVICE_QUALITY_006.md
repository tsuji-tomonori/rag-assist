# SQ-006 権限剥奪・削除反映 SLO

- 要件ID: `SQ-006`
- 種別: `REQ_SERVICE_QUALITY`
- 状態: Draft（目標値未承認）
- 優先度: S

## 要件

- SQ-006: システムは、共有解除、account/group 変更、失効、削除から全利用経路が deny を強制するまでの時間を測定し、承認済み SLO 以内に収めること。

## 品質尺度

- 尺度: authoritative change commit から、active/staged/old index、cache、session、memory、queued worker が deny するまでの最大・p95・p99 秒。
- fail point: `OQ-RD-004` で未確定。
- 目標値: `OQ-RD-004` で未確定。
- 状態: 値が承認されるまで release 合格済みと記録しない。

## 要求属性

| 属性 | 記入内容 |
| --- | --- |
| 識別子 | `SQ-006` |
| 説明 | revocation/deletion propagation latency |
| 根拠 | 剥奪後の exposure window を管理する |
| 源泉 | RAG ガイド §3.5.11（PDF p.81）、§8.1.7（PDF pp.188–189） |
| Actor / trigger | share/account/group/lifecycle change |
| 種類 | サービス品質制約 / security / freshness |
| 依存関係 | `FR-058`, `FR-066`, `FR-070`, `FR-072`, `FR-080`, `FR-081` |
| 衝突 | 物理 cleanup 完了時間と authorization deny 時間を分離する必要がある |
| 受け入れ基準 | `AC-SQ006-001`, `AC-SQ006-002` |
| 優先度 | S |
| 安定性 | Medium |
| Confidence | inferred |
| 所有者 | Security / SRE / Product |
| 変更履歴 | 2026-07-11 初版 |

## 受け入れ条件

### AC-SQ006-001 伝播測定

- Given: active session/cache/old index/queued run を含み、share revoke、account suspend/delete、role revoke、group membership removal、classification/usage/quality loss、automatic expiry、archive/delete の各 authoritative trigger を実行できる test fixture がある
- When: 各 trigger を独立した測定 run で commit または発火する
- Then: trigger × active/staged/old-index/cache/session/memory/queued-worker 経路ごとに最初の deny 時刻を記録し、最大・p95・p99 と未反映資源を report する

### AC-SQ006-002 未承認値の扱い

- Given: fail point または target が未承認である
- When: release report を作成する
- Then: measured value は記録しても SLO 合格とは表示しない

## 妥当性確認

| 観点 | 結果 | メモ |
| --- | --- | --- |
| 必要性 | OK | revoke/delete 後に旧権限が有効な exposure window を測定・制御するために必要 |
| 十分性 | OK | share/account/role/group/classification/usage/quality/expiry/delete trigger と active/staged/old index、cache、session、memory、queued worker の最大・p95・p99 を扱う |
| 理解容易性 | OK | authoritative commit から各経路の最初の deny までを測定区間として明示した |
| 一貫性 | OK | account revoke `FR-058`、deny-first `FR-066`、retrieval `FR-070`、index `FR-072`、role revoke `FR-080` と整合する |
| 標準・契約適合 | OK | RAG ガイドの revocation propagation と、未承認 SLO を合格扱いしない原則に適合する |
| 実現可能性 | OK | authoritative timestamp、path probe、clocked integration/chaos test で測定できる |
| 検証可能性 | OK | active session/cache/old index/queued run fixture の max・p95・p99 report で確認できる |
| ニーズ適合 | OK | 文書所有者・管理者が剥奪した権限の残存時間を把握し、承認水準内へ抑えられる |
| 定量性 | pending | 尺度は定義、閾値は open question |
| 実装適合 | OK（measurement contract、目標値未承認） | 10 trigger×7 path の70 probe completeness、p50/p95/p99/max、unreflected resource report を schema/metrics/gate で強制し、部分 matrix を unavailable にする focused test が pass |
| 合意 | pending | Security/SRE/PO が値を決定する |

## トレース

- 後方: `FR-066`, RAG ガイド PDF pp.81,188–189。
- 前方: revocation benchmark、SLO dashboard/alarm、`OQ-RD-004`。
