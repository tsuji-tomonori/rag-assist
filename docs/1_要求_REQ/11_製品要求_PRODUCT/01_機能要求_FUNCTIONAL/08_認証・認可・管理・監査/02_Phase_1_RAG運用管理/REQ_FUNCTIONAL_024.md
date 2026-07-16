# 要件定義（1要件1ファイル）

- 要件ID: `FR-024`
- 種別: `REQ_FUNCTIONAL`
- 状態: Draft（Phase 2 現行管理パネルへ同期済み）
- 優先度: A

## 分類（L0-L3）

- L0: `rag-assist / MemoRAG MVP 機能要件`
- L1主分類: `8. 認証・認可・管理・監査`
- L2主機能群: `8.2 RAG運用・governance 管理`
- L3要件: `FR-024`
- 関連カテゴリ:
  - `1. 文書・知識ベース管理`
  - `6. 問い合わせ・人手対応`
  - `7. 評価・debug・benchmark`


## 要件

- FR-024: 管理パネルは、現在の actor に認可された RAG 運用・governance 機能だけを表示し、ユーザー、ロール、利用状況・コスト、監査を対応する保護 API と同じ permission 境界で操作できること。

## 受け入れ条件（この要件専用）

- [x] AC-FR024-001: `管理者設定` から admin view へ遷移し、actor が読取 permission を持つ section だけを表示すること。
- [x] AC-FR024-002: users section は、ユーザー一覧、作成、停止、再開、削除を各 action permission に応じて表示・実行すること。
- [x] AC-FR024-003: roles section は、管理設定 permission と role assignment permission に応じてロール定義の参照とユーザーへのロール付与を表示・実行すること。
- [x] AC-FR024-004: usage/cost section は、利用状況とコストをそれぞれの読取 permission に応じて表示し、export permission がある場合だけ export を実行できること。
- [x] AC-FR024-005: audit section は、監査ログを読取 permission に応じて表示し、export permission がある場合だけ export を実行できること。
- [x] AC-FR024-006: UI の非表示だけを認可とせず、users、roles、usage/cost、audit の API が route-level permission と tenant 境界を強制すること。
- [x] AC-FR024-007: admin view から文書管理、問い合わせ対応、debug/評価、性能テストの既存運用導線へ actor permission に応じて遷移できること。
- [x] AC-FR024-008: `documents` view は認可された登録文書の一覧、upload、delete を提供し、チャット上部の文書選択には delete 操作を混在させないこと。

## 要件の源泉・背景

- 源泉: Phase 1 管理画面スコープの決定事項 D1-D10、Phase 2 管理 governance 実装、`NFR-011`、`/me` permission、benchmark runs 管理実装。
- 背景: 既存 UI では `管理者設定` と `ドキュメント` のナビゲーションボタンが専用 view に接続されていなかった。
- 背景: 文書削除などの運用操作はチャット利用導線から分離し、管理用途の画面に集約する必要がある。
- 背景: 最新 `main` では性能テスト管理が追加されたため、admin view からも permission に応じて遷移できる必要がある。
- 背景: Phase 2 ではユーザー lifecycle、role assignment、usage/cost、audit が管理パネルへ常設されたため、旧 AC-FR024-006 の非表示契約は現行正規契約と矛盾し、permission/API enforcement 契約へ置換した。

## 要件の目的・意図

- 目的: 管理機能を actor permission と API 認可境界に従って一つの governance panel から提供する。
- 意図: 利用者の通常チャット導線と、運用担当者の文書管理導線を分ける。
- 意図: 問い合わせ対応、debug/評価、性能テストは既存機能を主導線として使い、admin view から遷移できるようにする。
- 区分: 機能要求。

## 実装・検証トレース

- `confirmed`: `apps/web/src/features/admin/components/AdminWorkspace.tsx` は users、roles、usage/cost、audit section と各 action permission を定義する。
- `confirmed`: `apps/web/src/features/admin/components/AdminWorkspace.test.tsx` は permission に応じる管理 section/action の表示・操作を検証する。
- `confirmed`: `apps/api/src/authorization.test.ts` と `apps/api/src/security/access-control-policy.test.ts` は管理 API の route-level permission と保護 route policy を検証する。
- `conflict`: 旧 AC-FR024-006 は Phase 2 の常設管理パネルと直接矛盾したため、現行 governance 契約へ改訂した。
- `open_question`: なし。新しい管理 domain を追加する場合は permission と API enforcement を同じ変更で要件追加する。

## 関連文書

- `1_要求_REQ/11_製品要求_PRODUCT/11_非機能要求_NON_FUNCTIONAL/REQ_NON_FUNCTIONAL_011.md`
- `3_設計_DES/01_高レベル設計_HLD/DES_HLD_001.md`
- `3_設計_DES/41_API_API/DES_API_001.md`
