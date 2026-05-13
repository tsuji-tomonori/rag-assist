# 要件定義（1要件1ファイル）

- 要件ID: `NFR-013`
- 種別: `REQ_NON_FUNCTIONAL`
- 状態: Draft
- 優先度: S

## 要件

- NFR-013: API の副経路、streaming endpoint、worker callback は、対応する通常 API route と同等以上の route-level permission と所有者境界を維持すること。

## 受け入れ条件（この要件専用）

- AC-NFR013-001: 通常 route と同じ情報を返す副経路は、通常 route と同じ permission またはそれより狭い permission を要求すること。
- AC-NFR013-002: 所有者本人だけが読める情報を返す副経路は、所有者一致だけでなく必要な read permission も確認すること。
- AC-NFR013-003: 所有者以外の読み取りを許す副経路は、管理者向け read-all permission を要求すること。
- AC-NFR013-004: streaming endpoint は、接続確立前に permission と所有者境界を検査すること。
- AC-NFR013-005: 新規または変更された副経路は、route-level permission の静的 policy test または contract test で検証されること。

## 要件の源泉・背景

- 源泉: `reports/working/20260507-2013-access-control-audit.md`
- 背景: `GET /chat-runs/{runId}/events` の streaming Lambda で、Hono handler と permission 境界が一致していない実装不整合が見つかった。
- 背景: API Gateway や Lambda の配線上、同じ論理 route でも別 handler が存在すると、通常 route の認可前提が抜けるリスクがある。

## 要件の目的・意図

- 目的: streaming や worker 経由の副経路が、通常 API route の認可境界を迂回しないようにする。
- 意図: UI 表示制御、所有者一致、service user 権限だけに依存せず、route-level permission を一貫して検証する。
- 区分: 非機能要求。

## 要求属性

| 属性 | 記入内容 |
|---|---|
| 識別子 | `NFR-013` |
| 説明 | API 副経路と streaming endpoint の permission / owner 境界維持 |
| 根拠 | 別 Lambda や streaming endpoint は通常 route と異なる実装になり、認可漏れが起きやすい |
| 源泉 | `reports/working/20260507-2013-access-control-audit.md` |
| 種類 | 非機能要求 |
| 依存関係 | `FR-022`, `FR-027`, `NFR-010`, `NFR-011` |
| 衝突 | 副経路ごとの contract test と policy test の保守負荷が増える |
| 受け入れ基準 | `AC-NFR013-001` から `AC-NFR013-005` |
| 優先度 | S |
| 安定性 | High |
| 変更履歴 | 2026-05-07 初版 |

## 妥当性確認

| 観点 | 確認結果 | メモ |
|---|---|---|
| 必要性 | OK | 認可境界の迂回防止に必要 |
| 十分性 | OK | permission、owner、admin read-all、streaming、test を含む |
| 理解容易性 | OK | 通常 route と副経路の関係が明確 |
| 一貫性 | OK | 既存 RBAC / route policy test 方針と整合する |
| 標準・契約適合 | OK | 1 要件 1 ファイルと要件内受け入れ条件を満たす |
| 実現可能性 | OK | handler / contract test / static policy test で実現可能 |
| 検証可能性 | OK | 欠落 permission と admin read-all の回帰テストに落とせる |
| ニーズ適合 | OK | セキュリティ境界の再発防止に直結する |

## 関連文書

- `docs/3_設計_DES/41_API_API/DES_API_001.md`
- `docs/1_要求_REQ/31_変更管理_CHANGE/REQ_CHANGE_001.md`
