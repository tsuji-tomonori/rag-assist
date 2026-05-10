# 建築図面向け visual page retrieval を導入候補として評価する

保存先: `tasks/do/20260510-1433-drawing-visual-page-retrieval.md`

状態: do

## 背景

建築図面は図、表、線種、記号、レイアウトの情報量が大きく、OCR テキストだけでは正しいページに到達できない。ColPali / ColQwen 系の visual page retrieval は、ページ画像を直接検索対象にできるため候補になる。

## 目的

建築図面 QARAG suite に対して、既存 hybrid retrieval と visual page retrieval の比較評価を行い、default path へ入れる条件を明確にする。

## 対象範囲

- benchmark retrieval pipeline
- page rendering artifact
- visual embedding index candidate
- benchmark summary / report metrics
- 関連 docs

## 方針

まず gated adoption として実装し、既存 BM25 + dense + metadata retrieval を壊さない。visual retrieval は page_recall@k と latency / cost / index size を比較し、baseline を上回る場合だけ default 化候補にする。

## 必要情報

- `memorag-bedrock-mvp/docs/OPERATIONS.md` の高度検索技術 gated adoption 方針
- 既存 benchmark metrics
- 画像埋め込みモデルの実行環境、コスト、ライセンス

## 実行計画

1. 現行 benchmark で page_recall@k を計測できる入力と出力を確認する。
2. page image rendering artifact の保存方式を決める。
3. visual page embedding の index / search adapter を feature flag 付きで追加する。
4. hybrid retrieval との rerank / fusion 方法を評価する。
5. architecture-drawing-qarag で ablation report を出す。

## ドキュメントメンテナンス計画

検索方式、必要環境変数、コスト、index 更新手順、benchmark adoption gate を docs と PR 本文に記録する。

## 受け入れ条件

- [ ] AC1: visual page retrieval を feature flag または profile で有効化できる。
- [ ] AC2: architecture-drawing-qarag で page_recall@k、answer accuracy、unsupported rate、latency を baseline と比較できる。
- [ ] AC3: default path に入れない場合も、採用しない理由が report に残る。
- [ ] AC4: ACL / benchmark corpus isolation を弱めていない。

## 検証計画

- retrieval adapter unit test
- benchmark sample / ablation run
- no-access leak 指標確認
- `git diff --check`

## PRレビュー観点

- visual retrieval が通常ユーザー文書の認可境界を迂回していないか。
- index サイズ、コスト、latency の見積もりが PR 本文にあるか。
- benchmark 固有分岐ではなく profile / feature flag として実装されているか。

## 未決事項・リスク

- 決定事項: 初期は default 化せず、評価 profile として導入する。
- リスク: GPU / model availability / network download に依存する場合、CI での再現性が低くなる。
