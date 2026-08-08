# Open PR のマージ可否確認とマージ実行

- 状態: do
- タスク種別: 調査
- 作成日: 2026-08-08
- ブランチ: `codex/pr-merge-audit-20260808`

## 背景

repository の open PR について、ドラフト、競合、CI、レビュー、未解決 thread、変更範囲が異なるため、GitHub の表示だけでなく必要な品質ゲートを確認してからマージする必要がある。

## 目的

`tsuji-tomonori/rag-assist` の open PR を再走査し、現時点で安全にマージできる PR のみを exact head SHA 指定で main へマージする。マージしない PR は理由を記録する。

## スコープ

- open PR の一覧、draft、mergeability、CI、review、未解決 thread の確認
- 変更範囲に応じた docs、test、RAG 根拠性、認可境界、互換性の確認
- マージ可能な PR の merge commit 方式によるマージ
- 各マージ後の main と残 open PR の再確認
- task と作業レポートによる監査記録

## スコープ外

- マージ条件を満たさない PR の実装修正、rebase、競合解消
- PR close、branch delete、force-push
- deploy、release、production 操作

## 計画

1. GitHub Apps で open PR を列挙する。
2. 各 PR の metadata、workflow、review、thread、comments、変更ファイルを確認する。
3. 変更範囲に応じたセルフレビュー観点で blocking 要因を確認する。
4. 条件を満たす PR を expected head SHA 付きで一件ずつマージする。
5. 各マージ後に残 PR の状態を再取得する。
6. 結果を report、task、監査記録 PR に反映する。

## ドキュメント保守計画

- マージ判断と実行結果を `reports/working/` に記録する。
- 本タスク自体は production behavior を変更しないため、README、REQ/ARC/DES/OPS は更新しない。
- マージ対象 PR の docs と実装の同期は PR ごとの判断で確認する。

## 受け入れ条件

- [ ] 調査時点の全 open PR が一覧化されている。
- [ ] 各 PR の draft、mergeability、CI、review、未解決 thread、変更範囲が確認されている。
- [ ] 変更範囲に応じて docs、test、RAG 根拠性、認可境界、互換性が確認されている。
- [ ] マージ条件を満たす PR が exact head SHA 指定でマージされている。
- [ ] マージしない PR の理由と次の action が記録されている。
- [ ] 各マージ後の main と残 open PR の状態が再確認されている。
- [ ] 作業レポート、検証結果、GitHub Apps 操作、未実施事項が記録されている。
- [ ] 監査記録 PR に受け入れ条件コメントとセルフレビューコメントが日本語で投稿されている。

## 検証計画

- GitHub Apps: PR metadata / changed files / workflow runs / reviews / threads / comments
- `git diff --check`
- `pre-commit run --files <task-and-report-files>`
- 監査記録 PR の GitHub Actions

## PR レビュー観点

- green CI だけで draft、partial、競合、依存関係を見落とさないこと
- docs と実装の同期、変更範囲に見合うテストがあること
- RAG の根拠性・拒否制御・引用検証を弱めないこと
- 認証・認可・tenant/owner 境界を弱めないこと
- benchmark 期待語句、QA sample 固有値、dataset 固有分岐が実装にないこと
- stale PR が current main の仕様や実装を後退させないこと

## リスク

- 一件のマージで残 PR の mergeability や依存関係が変わる。
- workflow run が成功していても、required check や review 条件が別に存在する可能性がある。
- 大規模または古い PR は current main との意味的競合を含む可能性がある。

## 2026-08-08 調査・実行結果

- 調査開始時の open PR は 8 件: `#458`, `#460`, `#461`, `#462`, `#463`, `#464`, `#465`, `#467`。
- `#467` のみ non-Draft、`CLEAN / MERGEABLE`、current main に対して 0 behind / 4 ahead、11 files の focused 差分だった。
- `#467` head `9e6347cfa285ced8b050be4edebb5714d665b38d` では MemoRAG CI run 1349 と Validate Semver Label run 1726 が成功し、formal review と unresolved thread は 0 件だった。
- `#467` は `UNANSWERABLE` を回答生成へ昇格させない fail-closed 修正で、unit/integration test、FR-014 正文、source-backed API docs が同期していた。benchmark 固有値や dataset 固有分岐、認可境界の変更はなかった。
- 日本語の受け入れ条件コメント `5223973167` とセルフレビューコメント `5223973235` を投稿後、expected head SHA を指定した merge commit 方式でマージした。merge commit は `7e00dce8411a768927032ef7848a445621c564d0`。
- マージ後の open PR は 7 件で、全件 Draft かつ `mergeable=false`。追加マージ対象はない。

## 残 open PR の判定

| PR | 状態 | CI / review | 判定・次 action |
| --- | --- | --- | --- |
| `#458` | Draft、非 main base、mergeable false、583 files | workflow run なし、review/thread 0 | integration branch 間の収束 PR。base branch への統合と完了ゲートを満たすまで保留。 |
| `#460` | Draft、mergeable false、55 files | workflow run なし、review/thread 0 | 旧 main base の requirements stack。FR-014 部分は `#467` が focused に supersede。latest main へ再収束し重複を除去するまで保留。 |
| `#461` | Draft、mergeable false、59 files | workflow run なし、review/thread 0 | shared UI stack。latest main への再収束と UI quality gate 完了まで保留。 |
| `#462` | Draft、mergeable false、96 files | MemoRAG CI / Web UI Quality / Semver は成功、review/thread 0 | PR 本文が manual screen reader、zoom、実機、FR-051 owner 判断等の未完了を明記。merge-ready ではないため保留。 |
| `#463` | Draft、mergeable false、269 files | workflow run なし、review/thread 0 | benchmark quality stack。latest main 再収束、actual benchmark 未実施の明記、final-head CI が必要。 |
| `#464` | Draft、mergeable false、135 files | workflow run なし、review/thread 0 | auth/CloudFront/WebSocket/infra の大規模 stack。latest main 再収束と security/infra gate、final-head CI が必要。 |
| `#465` | Draft、mergeable false、379 files | workflow run なし、review/thread 0 | MemoRagService 分割 stack。latest main 再収束、公開 signature・tenant/permission 契約の再検証、final-head CI が必要。 |

## 受け入れ条件の確認状況

- [x] 調査時点の全 open PR が一覧化されている。
- [x] 各 PR の draft、mergeability、CI、review、未解決 thread、変更範囲が確認されている。
- [x] 変更範囲に応じて docs、test、RAG 根拠性、認可境界、互換性が確認されている。
- [x] マージ条件を満たす PR が exact head SHA 指定でマージされている。
- [x] マージしない PR の理由と次の action が記録されている。
- [x] 各マージ後の main と残 open PR の状態が再確認されている。
- [ ] 作業レポート、検証結果、GitHub Apps 操作、未実施事項が記録されている。
- [ ] 監査記録 PR に受け入れ条件コメントとセルフレビューコメントが日本語で投稿されている。
