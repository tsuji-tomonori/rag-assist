# ParsedDocument の管理者向け preview API/UI を追加する

保存先: `tasks/todo/20260516-1618-parsed-document-preview-api.md`

## 状態

- todo

## タスク種別

- 機能追加

## 背景

Phase E で `ParsedDocument` 相当の保存基盤は追加されたが、`docs/spec/gap-phase-e.md` の `E-OQ-011` として、管理 UI/API でどこまで公開するかが未確定のまま残っている。仕様 3A/3C/10 は、抽出結果、chunk、OCR/table/figure の状態を管理者が確認できることを求める。

## 目的

権限境界と機微情報 redaction を維持しながら、管理者または文書管理者が ParsedDocument summary、抽出 warning、table/figure/OCR preview を確認できる最小 read API/UI を追加する。

## 対象範囲

- document detail API / route
- `apps/api/src/rag/memorag-service.ts`
- `apps/web/src/features/documents/`
- OpenAPI generated docs
- access-control policy tests

## 実行計画

1. ParsedDocument payload の公開可能 field と非公開 field を分類する。
2. folder/document resource permission を満たす read API を設計する。
3. full raw text ではなく summary / counters / warning / location metadata を返す。
4. Web 文書詳細に preview / warning / table/figure metadata を表示する。
5. 低信頼・権限なし・未解析・旧 manifest の empty/error state を追加する。

## 受け入れ条件

- 管理者または権限を持つ文書管理者が ParsedDocument summary を確認できる。
- 権限がないユーザーは preview API と UI で内容を取得できない。
- raw prompt、credential、権限外文書、過剰な raw OCR text を返さない。
- 未解析または旧 manifest の文書は架空 preview を表示せず、正直な未提供状態になる。
- API route 追加時は OpenAPI docs と `access-control-policy.test.ts` が更新される。

## 検証計画

- `npm run test -w @memorag-mvp/api -- src/security/access-control-policy.test.ts`
- `npm run test -w @memorag-mvp/api -- src/contract/api-contract.test.ts`
- `npm run test -w @memorag-mvp/web`
- `npm run docs:openapi:check`
- `git diff --check`

## PRレビュー観点

- preview が RAG 検索や通常ユーザー回答に機微情報を漏らしていないか。
- No Mock Product UI に反し、架空 table/figure/quality count を表示していないか。
- 既存 manifest 互換を壊していないか。

## 関連

- `docs/spec/gap-phase-e.md` `E-OQ-011`
- `docs/spec/gap-phase-j3.md` `J3-GAP-002`
