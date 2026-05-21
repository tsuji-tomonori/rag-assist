# PR331 RAG scope と share ledger 修正

状態: done

## 背景

PR #331 の再レビューで Request changes が継続された。前回の share 情報漏えい、tenant 境界、route metadata、UI capabilities は概ね解消済みだが、RAG core retriever の folder scope に直接共有文書が混入し得る P0 と、share ledger の read-modify-write による lost update リスクが残っている。

## 目的

RAG core retriever の scope 判定を permission-aware にし、folder scope では直接文書 grant だけで通さないようにする。あわせて share grants / audit ledger を document 単位へ分割し、validation error を 400 として返す。

## タスク種別

修正

## なぜなぜ分析サマリ

- 問題文: direct document share を導入したことで、`mode=all` / `mode=documents` では直接共有文書を含める一方、`mode=groups` では対象 folder の read 権限を要求する必要がある。しかし core retriever では access 判定と scope 判定が分離され、scope 判定が folder permission を見ていないため、pre-check 漏れ時に folder scope へ直接共有文書が混入し得る。
- 確認済み事実:
  - `getLexicalIndex` は `canAccessManifest` 後に `manifestMatchesScope` を適用している。
  - `canAccessManifest` は folder permission がなくても direct document permission が `readOnly/full` なら true になり得る。
  - `manifestMatchesScope` は groups scope で manifest metadata の folder/group id 一致だけを見る。
  - `DocumentPermissionService` は global `documents/share-grants.json` を read-modify-write している。
- 推定原因:
  - document-level permission を追加した際、retriever 最終防衛線の scope 判定を folder-aware に拡張していなかった。
  - MVP 実装として share ledger を単一 JSON にまとめたため、別 document 更新や audit 追記との競合が同じファイルへ集中している。
- 根本原因:
  - folder scope と direct document scope の権限意味論が API pre-check と RAG retrieval の両方に必要だが、core retrieval 側のデータ構造が「アクセス可否」と「scope 一致」を別々に扱い、scope 固有の権限条件を表現していなかった。
  - share ledger の永続化境界が tenant/document ではなく global file になっており、権限データの更新単位と保存単位が一致していなかった。
- 対策:
  - retriever の scope 判定を async permission-aware helper に置換し、groups scope では requested folder に対する folder read 以上を要求する。
  - share grants と audit を `documents/share-grants/{tenantId}/{documentId}.json`、`documents/share-audit/{tenantId}/{documentId}.json` へ分割する。
  - duplicate / blank principal validation を route で 400 として扱うテストを追加する。

## チェックリスト

- [x] RAG `mode=all` / `mode=documents` で direct readOnly 文書を検索対象に含める。
- [x] RAG `mode=groups` で folder 権限なし direct readOnly 文書を除外する。
- [x] RAG `mode=groups` で folder readOnly 以上がある場合は文書を含める。
- [x] share grants / audit ledger を document 単位に分割し、既存 global ledger も読み取り互換にする。
- [x] docA/docB の同時 share 更新、同一 doc 同時更新、share 更新と move audit の競合回帰テストを追加する。
- [x] duplicate grant / blank principalId の validation API test を追加し 400 を確認する。
- [x] 関連 API test、coverage/typecheck/docs check、`git diff --check` を実行する。
- [x] 作業レポート、commit、push、PR コメントを更新する。

## Done 条件

- 再レビュー指摘 1-3 の完了条件に対応する unit / integration test が pass している。
- core retriever 単体で folder scope 境界を守れる。
- share ledger の別 document 更新が同じ global file を奪い合わない。
- E2E / Actions green が未実施なら、未実施として PR コメントと report に記録する。

## 受け入れ条件

- AC-RAG-SCOPE-001: direct readOnly 文書は `mode=all` で検索対象になる。
- AC-RAG-SCOPE-002: direct readOnly のみで folder 権限がない文書は `mode=groups` で検索対象にならない。
- AC-RAG-SCOPE-003: direct readOnly に加えて folder readOnly がある文書は `mode=groups` で検索対象になる。
- AC-RAG-SCOPE-004: direct readOnly 文書は `mode=documents` で検索対象になる。
- AC-LEDGER-001: docA/docB の share 更新が同時に走っても両方の grants が残る。
- AC-LEDGER-002: 同一 doc の同時 share 更新で grants 消失が起きない、または 409 相当の競合を検出する。
- AC-LEDGER-003: share 更新と move audit 追記が同時に走っても grants と audit の両方が残る。
- AC-VALIDATION-001: duplicate grant は validator で判別可能な validation error になる。
- AC-VALIDATION-002: duplicate grant / blank principalId の `PUT /documents/{id}/share` は 400 を返し、500 にならない。
- AC-VAL-001: 関連検証が pass する、または未実施理由が明記されている。

## 検証計画

- [x] `npm exec -w @memorag-mvp/api -- tsx --test src/search/hybrid-search.test.ts src/documents/document-permission-service.test.ts src/document-share-routes.test.ts`
- [x] `npm run test -w @memorag-mvp/api`
- [x] `npm run typecheck -w @memorag-mvp/api`
- [x] `npm run docs:openapi:check`
- [x] `npm run test:coverage -w @memorag-mvp/api`
- [x] `npm exec -- eslint apps/api --cache --cache-location .eslintcache-api --max-warnings=0`
- [x] `npm exec -- eslint apps/web --cache --cache-location .eslintcache-web --max-warnings=0`
- [x] `npm run docs:web-inventory:check`
- [x] `npm exec -w @memorag-mvp/web -- vitest run --coverage`
- [x] `npm run typecheck -w @memorag-mvp/web`
- [x] `npm run build -w @memorag-mvp/api`
- [x] `npm run build -w @memorag-mvp/web`
- [x] `git diff --check`

## ドキュメント保守計画

OpenAPI generated docs に差分が出る場合は更新する。RAG scope の意味論は PR コメントと report に明記し、durable docs 更新が必要か実装後に判断する。

## PR レビュー観点

- folder scope では direct document grant だけで通さないこと。
- all / documents scope では direct document grant を失わないこと。
- share ledger 分割により tenant/document 境界と audit 保存が壊れないこと。
- validation error が 500 にならないこと。

## リスク

- E2E は未実行のまま残る可能性がある。
- GitHub Actions head commit green は push 後の GitHub 側状態に依存する。
