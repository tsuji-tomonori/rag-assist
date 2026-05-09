# 建築図面 QARAG ベンチマーク正本の JSON 化

状態: done

## 背景

ユーザーから、`memorag-bedrock-mvp/benchmark/architecture-drawing-qarag-v0.1.md` は説明用なのか、性能テストに使うのであれば JSON 等の機械処理しやすい形式にすべきではないか、という指摘があった。

## 目的

建築図面 QARAG ベンチマークの性能テスト用正本を Markdown parser 依存から JSON へ移し、Markdown は説明・閲覧用として位置づける。

## 受け入れ条件

- [x] AC1: 性能テスト用の正本データが JSON 形式で管理される。
- [x] AC2: runner の dataset / corpus 準備処理が Markdown ではなく JSON を読む。
- [x] AC3: Markdown は説明用であり、性能テスト実行は JSON を使うことを README または Markdown に明記する。
- [x] AC4: JSON から 82 件の dataset row が生成されることを test で確認する。
- [x] AC5: 変更範囲に見合う検証を実行し、未実施の検証があれば理由を記録する。
- [x] AC6: 作業完了レポートを `reports/working/` に保存する。
- [x] AC7: PR 更新後、受け入れ条件確認コメントとセルフレビューコメントを日本語で投稿する。

## 検証計画

- `npm --prefix memorag-bedrock-mvp run test -w @memorag-mvp/benchmark`
- `npm --prefix memorag-bedrock-mvp run typecheck -w @memorag-mvp/benchmark`
- 関連 API / infra / docs 差分の軽量確認
- `git diff --check`
- `pre-commit run --files <changed-files>`

## 実施結果

- `memorag-bedrock-mvp/benchmark/architecture-drawing-qarag-v0.1.json` を追加し、82 件の seed QA と 13 件の source を機械処理用正本として管理。
- `architecture-drawing-qarag.ts` の入力を Markdown parser から JSON parser に変更し、`ARCHITECTURE_QARAG_CONFIG` で正本 JSON を差し替え可能にした。
- README と Markdown 冒頭に、Markdown は説明・レビュー用、性能テストの正本は JSON であることを明記。
- benchmark test を JSON 正本の 82 row 生成確認へ更新。

## 検証結果

- `npm --prefix memorag-bedrock-mvp run test -w @memorag-mvp/benchmark`: pass
- `npm --prefix memorag-bedrock-mvp run typecheck -w @memorag-mvp/benchmark`: pass
- `git diff --check`: pass
- `pre-commit run --files memorag-bedrock-mvp/README.md memorag-bedrock-mvp/benchmark/architecture-drawing-qarag-v0.1.md memorag-bedrock-mvp/benchmark/architecture-drawing-qarag-v0.1.json memorag-bedrock-mvp/benchmark/architecture-drawing-qarag.test.ts memorag-bedrock-mvp/benchmark/architecture-drawing-qarag.ts tasks/do/20260509-1038-architecture-benchmark-json-source.md reports/working/20260509-1042-architecture-benchmark-json-source.md`: pass

## 未実施・制約

- 実際の外部 PDF download を伴う `npm run prepare:architecture-drawing-qarag -w @memorag-mvp/benchmark` は、ネットワークと公開元 URL の揺らぎに依存するため未実施。runner の JSON 読み取りと corpus download 対象制御は mocked fetch の unit test で確認。
- API / web / infra の再検証は未実施。今回の差分は benchmark 正本・benchmark runner・説明文書に閉じており、既存 suite ID や UI/API whitelist は変更していないため。

## PR コメント

- 受け入れ条件確認コメントを PR #212 に投稿。
- セルフレビューコメントを PR #212 に投稿。
