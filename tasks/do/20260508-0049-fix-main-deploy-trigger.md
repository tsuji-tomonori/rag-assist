# main merge deploy trigger failure fix

保存先: `tasks/do/20260508-0049-fix-main-deploy-trigger.md`

状態: do

## 背景

ユーザーから「mainへマージしてもデプロイされないのは何故? 障害レポートを作成したうえでなぜ分析を行い修正して」と依頼された。`main` への PR マージ後に GitHub Actions の deploy workflow が起動しない、または deploy job が実行されない原因をリポジトリ上の workflow 設定から特定し、修正する必要がある。

## 目的

`main` へのマージ後に deploy workflow が期待どおり動くように、原因を根拠付きで分析し、必要な workflow 設定を修正する。併せて、障害レポートと作業完了レポートを残す。

## 対象範囲

- `.github/workflows/memorag-deploy.yml`
- 関連する GitHub Actions workflow 設定
- `reports/bugs/` の障害レポート
- `reports/working/` の作業完了レポート
- 本 task md

## 方針

- まず deploy workflow の `on:` 条件、job-level `if:`、branch/path filter、workflow 間依存を確認する。
- 直接証拠に基づいて「なぜ deploy されないか」を障害レポートに記録する。
- 修正は deploy workflow の発火条件に絞り、不要な CI/CD 再設計は行わない。
- main merge による deploy を復旧するが、PR 上の不要な deploy や意図しない branch deploy を増やさない。

## 必要情報

- 対象 workflow: `.github/workflows/memorag-deploy.yml`
- 関連 workflow: `.github/workflows/memorag-ci.yml`, `.github/workflows/release-management.yml`
- 既存レポート: `reports/working/20260502-0000-disable-auto-deploy-workflow.md`, `reports/working/20260502-0310-fix-deploy-workflow-branch-guard.md` など deploy 設定変更履歴
- 推定リスク: GitHub Actions の `paths` filter や `branches` filter の組み合わせにより、main merge commit が workflow 対象外になる可能性

## 実行計画

1. deploy workflow と関連レポートを確認し、現状の発火条件を整理する。
2. 原因と影響を `reports/bugs/` に障害レポートとして記録する。
3. `.github/workflows/memorag-deploy.yml` を最小差分で修正する。
4. YAML/Markdown 差分の機械的検証を実行する。
5. 作業完了レポートを `reports/working/` に作成する。
6. commit、push、PR 作成、受け入れ条件コメント、セルフレビューコメントを実施する。
7. PR コメント後に task md を `tasks/done/` へ移動して、同じ branch に追加 commit / push する。

## ドキュメントメンテナンス計画

- workflow 設定変更の理由と影響は障害レポートと PR 本文へ記録する。
- README、API 例、OpenAPI、RAG 要件、認可設計への挙動変更は想定しない。調査で運用手順への影響が見つかった場合のみ docs 更新を追加する。
- 実施していない deploy 実行や本番反映は、実施済みとして書かない。

## 受け入れ条件

- [ ] main merge 後に deploy されない原因が、workflow 設定の具体的な根拠付きで説明されている。
- [ ] `reports/bugs/` に障害レポートが作成され、事実・推定・対応が分離されている。
- [ ] main merge で deploy workflow が起動対象になるように設定が修正されている。
- [ ] 変更範囲に対して最小十分な検証が実行され、未実施の検証は理由付きで記録されている。
- [ ] PR 作成後に受け入れ条件確認コメントとセルフレビューコメントが日本語で投稿されている。

## 検証計画

- `git diff --check`
- 変更した YAML の構文/発火条件の目視確認
- 可能なら `pre-commit run --files <changed-files>`
- 実際の main merge deploy は PR merge 後の外部 GitHub Actions 事象のため、この作業内では未実施として明記する。

## PRレビュー観点

- deploy workflow の `on:` 条件が `main` push を対象にしていること。
- PR や feature branch で不要な deploy が走らないこと。
- path filter を使う場合、infra/app workflow 変更など deploy に必要な差分が除外されないこと。
- 未実施の本番 deploy 確認を実施済み扱いしていないこと。
- docs と実装の同期、変更範囲に見合う検証、RAG の根拠性・認可境界への非影響が明記されていること。

## 未決事項・リスク

- 決定事項: 実際の deploy 実行は PR merge 後に GitHub Actions 上で確認する。作業内では workflow 設定の静的検証までを完了条件とする。
- リスク: GitHub Actions の repository setting、environment protection、AWS credential 設定などリポジトリ外状態が原因に含まれる場合、workflow 修正だけでは完全復旧しない可能性がある。
