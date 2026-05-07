# 作業完了レポート: benchmark search override 脆弱性修正

## 受領した指示
- Aardvark 検知の高リスク脆弱性（`/benchmark/search` の ACL なりすまし）を HEAD で確認し、残存していれば最小修正で対処する。
- 既存機能とテストを可能な限り維持しつつ remediation を実施する。

## 要件整理
- `/benchmark/search` で caller 指定 `user` を ACL 主体として使わないようにする。
- 最小修正として API 挙動を安全側に倒す。
- 関連 contract test を実装意図に合わせて更新し、実行確認する。

## 検討・判断
- 根本原因は `benchmarkSearchUser` が `request.user` を `service.search` の実効ユーザーに変換していた点。
- 互換より安全性優先の最小修正として、`user` override が渡された場合は 400 を返し拒否する方針を採用。
- この方針で ACL なりすまし経路を単純に遮断できる。

## 実施作業
1. `memorag-bedrock-mvp/apps/api/src/app.ts`
   - `benchmarkSearchUser` を変更し、`requestUser` 指定時は常に `HTTP 400` を返却するよう修正。
2. `memorag-bedrock-mvp/apps/api/src/contract/api-contract.test.ts`
   - テスト名を「dataset user override を許可しない」意図へ変更。
   - override を使った3ケースの期待値を 400 拒否へ更新。
3. 対象テストを絞って実行し、修正後に成功を確認。

## 成果物
- コード修正 2 ファイル。
- 作業レポート本ファイル。

## 指示への fit 評価
- HEAD に脆弱挙動が残存することを確認し、最小差分で remediation を実装。
- 未実施項目を実施済みとする記載はなし。

## 未対応・制約・リスク
- `BenchmarkSearchRequestSchema` 上は `user` フィールドが依然定義されるため、クライアントは送信自体は可能（ただし常に 400）。
- 将来的に安全な override 要件が必要なら、benchmark run 単位の承認済み subject 束縛設計が別途必要。
