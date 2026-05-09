# 建築図面 QARAG ベンチマークの UI 実行対応

状態: done

## 背景

前作業で建築図面 QARAG ベンチマーク v0.1 を Markdown 管理へ移行した。ユーザーから、これを UI から実行できるベンチマークとして扱う追加依頼があった。

## 目的

管理画面の benchmark UI から `architecture-drawing-qarag-v0.1` を選択し、CodeBuild runner で dataset と corpus を準備して agent benchmark run を起動できるようにする。

## スコープ

- API の benchmark suite 一覧に建築図面 QARAG suite を追加する。
- benchmark runner 用に Markdown から dataset JSONL と corpus を準備するスクリプトを追加する。
- CodeBuild pre_build で当該 suite の準備スクリプトを呼び出す。
- benchmark seed corpus の認可 whitelist に当該 suite を追加する。
- README と作業レポートを更新する。
- 必要な unit / typecheck / infra snapshot 検証を実行する。

## 受け入れ条件

- [x] AC1: `/benchmark-suites` に `architecture-drawing-qarag-v0.1` が含まれ、UI の suite 選択肢に出る。
- [x] AC2: UI から選択した suite で benchmark run を起動すると、API が未知 suite として拒否しない。
- [x] AC3: CodeBuild runner が当該 suite の dataset JSONL と corpus dir を準備できる。
- [x] AC4: benchmark seed corpus のアップロード・削除認可で当該 suite が許可される。
- [x] AC5: README に UI 実行方法と制約を明記する。
- [x] AC6: 変更範囲に見合う検証を実行し、未実施の検証があれば理由を記録する。
- [x] AC7: 作業完了レポートを `reports/working/` に保存する。
- [x] AC8: PR 更新後、受け入れ条件確認コメントとセルフレビューコメントを日本語で投稿する。

## 検証結果

- `npm ci`: pass
- `npm --prefix memorag-bedrock-mvp run test -w @memorag-mvp/benchmark`: pass
- `npm --prefix memorag-bedrock-mvp run typecheck -w @memorag-mvp/benchmark`: pass
- `npm --prefix memorag-bedrock-mvp run test -w @memorag-mvp/api -- contract/api-contract.test.ts`: pass
- `npm --prefix memorag-bedrock-mvp run typecheck -w @memorag-mvp/api`: pass
- `npm --prefix memorag-bedrock-mvp run test -w @memorag-mvp/web -- features/benchmark/hooks/useBenchmarkRuns.test.ts`: pass
- `npm --prefix memorag-bedrock-mvp run typecheck -w @memorag-mvp/web`: pass
- `UPDATE_SNAPSHOTS=1 npm --prefix memorag-bedrock-mvp run test -w @memorag-mvp/infra -- memorag-mvp-stack.test.ts`: pass
- `npm --prefix memorag-bedrock-mvp run test -w @memorag-mvp/infra -- memorag-mvp-stack.test.ts`: pass
- `npm --prefix memorag-bedrock-mvp run typecheck -w @memorag-mvp/infra`: pass
- `git diff --check`: pass
- `pre-commit run --files ...`: pass

## 既知の制約

- UI から run 起動はできるが、実際の CodeBuild 実行では国土交通省・自治体の公開 PDF URL への到達性と PDF/OCR 抽出結果に依存する。
- ローカル検証では外部 PDF の実 download と本番 CodeBuild run は実行していない。
- PR: https://github.com/tsuji-tomonori/rag-assist/pull/212
- PR 受け入れ条件コメント: posted
- PR セルフレビューコメント: posted

## 検証計画

- benchmark prepare script の unit test
- API benchmark suite / run 作成 test
- infra CodeBuild buildspec test / snapshot
- web hook または API mock test
- `git diff --check`
- 変更ファイル対象の `pre-commit run --files`

## リスク

- CodeBuild runner は公開 PDF URL の取得に依存するため、公開元 URL 変更やネットワーク制約で dataset/corpus 準備が失敗しうる。
- 図面 PDF の OCR / Textract 結果に依存するため、全 seed QA が直ちに高精度で通ることは保証しない。
