# API CI 修正レポート

## 受けた指示

- PR #321 の MemoRAG CI で API lint と API coverage test が失敗しているため、原因を確認して修正する。

## 要件整理

- CI と同等の API lint command をローカルで再現する。
- CI と同等の API coverage threshold command をローカルで再現する。
- folder canonical path 実装の意図を変えず、最小差分で修正する。

## 実施作業

- `no-control-regex` lint error を避けるため、制御文字判定を正規表現から `charCodeAt` ベースの helper に変更。
- API branch coverage が 84.98% で閾値 85% に足りなかったため、document group name validation と group admin principal validation の分岐テストを追加。

## 成果物

- `apps/api/src/rag/memorag-service.ts`
- `apps/api/src/rag/memorag-service.test.ts`

## 検証

- `npm exec -- eslint apps/api --cache --cache-location .eslintcache-api --max-warnings=0`: pass
- `npm exec -w @memorag-mvp/api -- c8 --check-coverage --statements 90 --branches 85 npm test`: pass
- `npm run typecheck -w @memorag-mvp/api`: pass
- `git diff --check`: pass

## fit 評価

- CI で失敗していた API lint と API coverage threshold の両方をローカル再現し、同等コマンドで pass まで確認した。
- 変更は folder name validation の実装形態とテスト追加に限定し、API contract / Web / Infra には影響しない。

## 未対応・制約・リスク

- GitHub Actions の再実行結果は push 後に確認する必要がある。
