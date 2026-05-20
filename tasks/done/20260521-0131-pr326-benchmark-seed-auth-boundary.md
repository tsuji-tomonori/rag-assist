# PR326 benchmark seed auth boundary

- 状態: done
- タスク種別: 修正
- 対象 PR: https://github.com/tsuji-tomonori/rag-assist/pull/326

## 背景

PR #326 の再レビューで、`POST /documents` の legacy 経路において、`rag:doc:write:group` のみを持つユーザーが benchmark seed 形式の body を送ると、`purpose=benchmarkSeed` と扱われて group scope 必須チェックを迂回できる可能性が指摘された。

## 目的

benchmark seed 形式の body は必ず `benchmark:seed_corpus` を要求し、通常 writer が benchmark seed metadata を混ぜて folder scope 境界を迂回できないようにする。

## 受け入れ条件

- [x] `rag:doc:write:group` のみでは benchmark seed 形 body を `POST /documents` できない。
- [x] `benchmark:seed_corpus` では benchmark seed body を group scope なしで `POST /documents` できる。
- [x] 通常 writer が group scope 付きでも benchmark seed metadata を混ぜた場合は拒否される。
- [x] `authorizeDocumentUpload` の単体テストで benchmark seed body は `benchmark:seed_corpus` 専用であることを固定する。
- [x] 関連 API テスト、typecheck、diff check が pass する。
- [x] PR に受け入れ条件確認コメントとセルフレビューコメントを日本語で追加する。

## 完了結果

- 実装修正 commit: `663d07b9dcd587b01803fa3ce85315934e69425b`
- 受け入れ条件確認コメント: https://github.com/tsuji-tomonori/rag-assist/pull/326#issuecomment-4500556067
- セルフレビューコメント: https://github.com/tsuji-tomonori/rag-assist/pull/326#issuecomment-4500557923
- 作業レポート: `reports/working/20260521-0131-pr326-benchmark-seed-auth-boundary.md`

## 検証計画

- `../../node_modules/.bin/tsx --test src/contract/api-contract.test.ts`
- `npm run typecheck -w @memorag-mvp/api`
- `git diff --check`

## リスク

- `POST /documents` の legacy benchmark seed 登録は BENCHMARK_RUNNER のみ許可される。通常 writer が benchmark seed metadata を含む通常文書を送る用途は拒否されるが、権限境界として意図した挙動。
