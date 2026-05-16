# 章別仕様 gap 全量実装

- 状態: done
- 種別: 機能追加 / 仕様差分解消
- 作成日: 2026-05-16
- 対象仕様: `docs/spec/2026-chapter-spec.md` および `.workspace/rag-assist_仕様追加_章別定義_管理者向け構成版 (1).md`

## 背景

章別仕様レビューで task 化した gap について、PM 指示として全量対応、検証、PR 作成、PR 確認コメントまで進める。

## スコープ

- 文書抽出品質と ParsedDocument preview の API/UI 反映
- Chat tool registry / invocation 監査 route の追加
- Async Agent provider settings / artifact writeback metadata の追加
- Debug replay plan と export / revocation 境界の明文化
- Admin 品質 action、監査・コスト export、実データ由来 UI 表示への更新
- Async Agent benchmark metadata runner の追加
- OpenAPI / contract / access-control policy / generated docs の同期

## 受け入れ条件

- 通常 RAG 品質 gate が品質 profile と低 confidence 抽出情報を考慮する。
- ParsedDocument preview API が権限内文書だけに sanitize 済み preview を返す。
- Chat tool registry と invocation audit を protected route として取得できる。
- Async Agent の provider 設定状態と artifact writeback 承認 metadata を secret なしで扱える。
- Debug replay は実行せず、sanitize 済み replay plan metadata のみを返す。
- Admin UI は API 由来データと未提供状態を区別し、固定 fallback を本番表示しない。
- Benchmark runner が async-agent unavailable/provider metadata と artifact redaction を評価できる。
- 新規 route は access-control policy test と OpenAPI docs に登録されている。
- `npm run lint`、`npm run typecheck`、`npm test --workspaces --if-present`、`npm run build`、`npm run docs:openapi:check`、`git diff --check` が成功する。

## 完了確認

- PR: https://github.com/tsuji-tomonori/rag-assist/pull/319
- 受け入れ条件確認コメント: 投稿済み
- セルフレビューコメント: 投稿済み
