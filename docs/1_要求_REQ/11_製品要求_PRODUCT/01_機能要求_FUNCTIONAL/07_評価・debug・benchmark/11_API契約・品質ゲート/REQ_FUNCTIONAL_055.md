# FR-055 API共通 middleware・非同期 worker 契約

- 種別: `REQ_FUNCTIONAL`
- 状態: planning
- 仕様参照: `docs/spec/2026-chapter-spec.md` 14D 章

## 要求

CORS、public endpoint、auth middleware、SSE Last-Event-ID、chat / ingest / benchmark / async agent worker の runId 契約を API 共通処理として管理できること。

## 受け入れ条件

- [ ] public endpoint と protected endpoint の境界が明示されている。
- [ ] SSE 再接続時の Last-Event-ID と runId 契約が文書化されている。
- [ ] worker handler は runId を契約として状態・event・artifact を追跡できる。

## 備考

Phase J2 / G で詳細化する。
