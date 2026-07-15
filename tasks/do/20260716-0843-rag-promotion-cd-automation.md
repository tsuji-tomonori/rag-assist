# dev RAG 品質 policy の承認反映と CD 自動準備

- 状態: do
- タスク種別: 修正

## 背景

`Deploy MemoRAG MVP` は `RAG_QUALITY_POLICY_S3_URI` と `RAG_QUALITY_OBSERVATIONS_S3_URI` を GitHub Environment variables または手動 dispatch input から受け取る設計だが、`dev` には両方が設定されていない。このため main push のたびに build / synth / deploy より前の input validation で失敗する。

ユーザーは `memorag-dev-rag-quality` の `2026-07-16.draft-1` を dev 初期 policy として承認し、policy file の作成、CD 内での S3 upload、URI の自動解決を依頼した。

## なぜなぜ分析

1. なぜ workflow が 21 秒で失敗したか: 必須の二つの S3 URI が空だったため。
2. なぜ URI が空だったか: repository / `dev` environment に variables がなく、手動 dispatch input も指定されなかったため。
3. なぜ毎回手動設定が必要だったか: deploy workflow が完成済み artifact の外部投入だけを受け付け、policy の承認済み source、stack output の bucket、個別 observation から bundle を組み立てる処理を持たなかったため。
4. なぜ自動生成へ切り替えられなかったか: threshold と version dimensions を承認なしに補うと promotion gate の根拠性を壊すため、承認済み policy source が先に必要だったため。
5. 根本原因: fail-closed gate と artifact producer / resolver の運用境界が分断され、main push CD に必要な標準化された承認済み source と自動準備工程がなかった。

## 確認済み事項

- `MemoRagMvpStack` は `DocumentsBucketName` を CloudFormation output として公開する。
- active policy は docs bucket の `quality-control/policies/active.json` から runtime monitor が読む。
- runtime monitor は observation を `quality-control/observations/` 以下へ一件ずつ JSON 保存する。
- promotion gate は policy object 一件と observations array 一件を要求する。
- 欠損 observation、version/profile 不一致、未承認 policy、threshold 違反は pass として扱えない。
- 承認済み profile/version は `memorag-dev-rag-quality@2026-07-16.draft-1` である。

## 目的

承認済み dev policy を repository の正規 source とし、CD が CloudFormation output から bucket を解決して policy と observation bundle を S3 に保存し、promotion gate 用 URI を自動設定できるようにする。観測証跡が不足する初回は policy を active 化する一方で deploy は安全に保留する。

## 対象範囲

- policy と全 gate の承認者・承認時刻の記録
- placeholder を workflow の authoritative version values で解決する candidate preparation
- `DocumentsBucketName` の自動解決
- versioned policy snapshot と active policy の S3 upload
- matching observation の配列化と versioned bundle upload
- `RAG_QUALITY_POLICY_S3_URI` / `RAG_QUALITY_OBSERVATIONS_S3_URI` の `GITHUB_ENV` 自動設定
- 証跡不足時の deploy 保留と、揃った証跡に対する promotion gate 強制
- workflow contract、generator、preparation logic、運用文書の検証

## 対象外

- observation value の生成・捏造
- live AWS での workflow dispatch / CDK deploy
- PR merge
- production policy の承認

## 実施計画

1. runtime / benchmark の version source と observation contract を確認する。
2. draft generator / JSON を承認済み policy source へ昇格する。
3. policy placeholder 解決、observation 選別・bundle 化、準備状態出力を実装する。
4. deploy workflow に bucket 解決、S3 upload、URI export、defer / gate 分岐を実装する。
5. OPS 文書と workflow contract tests を更新する。
6. focused tests、lint/typecheck、docs check、diff check を実行する。
7. PR 本文・受け入れコメント・セルフレビュー・作業レポートを更新する。

## 受け入れ条件

- [ ] `memorag-dev-rag-quality@2026-07-16.draft-1` に `approvedBy=tsuji-tomonori` と承認時刻が入り、全 gate の threshold 承認情報も同じ承認へ固定される。
- [ ] workflow が GitHub variables / dispatch input の S3 URI を要求しない。
- [ ] workflow が CloudFormation output `DocumentsBucketName` から docs bucket を自動解決する。
- [ ] workflow が placeholder 解決済み policy snapshot と active policy を S3 upload し、その URI を自動設定する。
- [ ] workflow が profile/version/version dimensions の一致する個別 observation のみを JSON array bundle にし、versioned S3 URI を自動設定する。
- [ ] 必須 observation が不足する場合は値を補わず deploy を保留し、理由を workflow summary と artifact に残す。
- [ ] observation が揃う場合は promotion gate が build / synth / deploy より前に実行され、fail を迂回できない。
- [ ] CDK bootstrap / synth / deploy が policy と一致する version context を受け取る。
- [ ] 対象テスト、lint/typecheck、docs validation、`git diff --check` が成功する。
- [ ] 実 deploy と PR merge は実行せず、未実施として明記する。

## ドキュメント保守計画

- `OPS_MONITORING_001.md` の手動 URI 前提を自動準備・初回 defer・versioned artifact の運用へ更新する。
- README / API docs は公開 interface を変更しないため、影響がないことを最終レポートで確認する。

## PR レビュー観点

- 欠損値を 0 や合格値で補っていないか。
- profile/version/version dimensions が一致しない observation を混ぜていないか。
- `quality-control/policies/active.json` が未解決 placeholder を含まないか。
- promotion gate の fail が build / synth / deploy を許可しないか。
- dataset / QA sample 固有値・固有分岐を product runtime に追加していないか。
- bucket 名、account、region を hardcode していないか。

## リスク

- 既存 stack がまだ存在しない bootstrap 前は output bucket を解決できず、policy upload を開始できない。既存 dev stack の修正を対象とし、初回 stack 作成手順は別途明示する。
- 承認後も代表 workload の全必須 evidence が揃うまで deploy は保留される。
- live AWS IAM 権限はこの PR の静的検証だけでは確認できない。
