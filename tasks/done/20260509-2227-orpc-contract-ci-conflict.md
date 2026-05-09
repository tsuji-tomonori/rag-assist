# oRPC contract PR の競合解消と CI 修正

状態: done

## 背景

PR #227 に対して、`main` との競合と MemoRAG CI の複数 job failure が報告された。対象は infra/api/web/benchmark の typecheck/test/build、OpenAPI docs check、CDK synth。

## 目的

PR branch `codex/orpc-contract` を最新 `origin/main` に追従させ、競合と CI failure の原因を修正する。

## スコープ

- `origin/main` の取り込みと競合解消
- GitHub Actions の失敗ログ確認
- typecheck/docs/test/build/CDK failure に必要な修正
- ローカル検証、作業レポート、commit/push、PR コメント更新

## スコープ外

- PR #227 の目的から外れる機能追加
- unrelated CI failure の恒久対応
- PR merge、force-push、production deploy

## 作業計画

1. PR と CI の状態を確認する。
2. `origin/main` を取り込み、競合があれば最小差分で解消する。
3. CI ログから failure の一次原因を特定する。
4. 競合解消後のコードに合わせて修正する。
5. 失敗 job に対応する検証をローカルで実行する。
6. 作業レポート、commit、push、PR コメント更新を行う。

## ドキュメント保守計画

挙動や運用説明が変わる場合のみ README または該当 docs を更新する。競合解消のみで durable docs への追記が不要な場合は作業レポートに理由を記録する。

## 受け入れ条件

- [x] PR branch が `origin/main` と競合しない状態になる。
- [x] CI failure の主要原因がログから確認され、必要な修正が入る。
- [x] infra/api/web/benchmark の失敗項目に対応するローカル検証が pass する、または未実施理由が記録される。
- [x] PR に競合解消・CI 修正内容と検証結果を日本語でコメントする。
- [x] 作業レポートを `reports/working/` に残す。

## 検証計画

- `git diff --check`
- `npm run typecheck -w @memorag-mvp/infra`
- `npm run typecheck -w @memorag-mvp/api`
- `npm run docs:openapi:check`
- `npm run typecheck -w @memorag-mvp/web`
- `npm run typecheck -w @memorag-mvp/benchmark`
- 失敗原因に応じた `npm test` / coverage / build / CDK synth

## PR レビュー観点

- 競合解消で main 側変更を落としていないこと。
- `/rpc/*` の認証・認可境界が維持されていること。
- docs/OpenAPI と実装の整合が崩れていないこと。
- benchmark 固有値や dataset 固有分岐を実装へ混ぜていないこと。

## リスク

- CI ログの failure が merge conflict 起因で連鎖している可能性。
- CDK synth は環境や cdk-nag の制約で追加対応が必要になる可能性。
