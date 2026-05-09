# 建築図面 QARAG ベンチマーク v0.1 の Markdown 管理

状態: in_progress

## 背景

ユーザーは `.workspace/architecture_drawing_qarag_benchmark_v0_1.xlsx` と調査メモを提示し、Excel ではなく Markdown で管理するよう依頼した。

## 目的

建築・AEC 図面理解向け QARAG ベンチマーク v0.1 の内容を、リポジトリでレビュー・差分確認しやすい Markdown 成果物として管理する。

## スコープ

- Excel のシート構成と seed QA の主要内容を確認する。
- ベンチマーク定義、既存ベンチマーク比較、ソース、評価観点を Markdown に整理する。
- 既存 README から Markdown 成果物へ参照できるようにする。
- 実装コードや benchmark runner の挙動変更は含めない。

## 作業計画

1. Excel のシート、列、行数を確認する。
2. Markdown 管理先を決める。
3. ベンチマーク定義 Markdown を作成する。
4. README などの参照先を必要最小限で更新する。
5. Markdown 差分と末尾空白を検証する。
6. 作業完了レポートを作成する。
7. commit / push / PR 作成、受け入れ条件コメント、セルフレビューコメントまで進める。

## ドキュメント保守方針

今回の変更はコード挙動ではなく評価 dataset 企画・定義の管理形式変更である。`memorag-bedrock-mvp/benchmark/` 配下に Markdown のベンチマーク定義を置き、既存の benchmark 説明から参照する。`memorag-bedrock-mvp/docs/` の要求本文は、runner 実装や正式な suite 追加を伴わないため原則更新しない。

## 受け入れ条件

- [x] AC1: Excel の内容を確認し、Markdown 管理対象に必要なシート情報と seed QA 情報を反映する。
- [x] AC2: 建築図面 QARAG ベンチマーク v0.1 を Excel ではなく Markdown ファイルとしてリポジトリ内に追加する。
- [x] AC3: Markdown には目的、運用方針、既存ベンチマーク比較、公的図面ソース、評価観点、seed QA 一覧または同等の管理情報を含める。
- [x] AC4: 既存 README などから追加 Markdown への参照を追加する。
- [x] AC5: 変更範囲に見合う検証を実行し、未実施の検証があれば理由を記録する。
- [x] AC6: 作業完了レポートを `reports/working/` に保存する。
- [ ] AC7: PR 作成後、受け入れ条件確認コメントとセルフレビューコメントを日本語で投稿する。

## 検証結果

- `git diff --check`: pass
- `pre-commit run --files memorag-bedrock-mvp/README.md memorag-bedrock-mvp/benchmark/architecture-drawing-qarag-v0.1.md tasks/do/20260509-1002-architecture-drawing-qarag-md.md reports/working/20260509-1006-architecture-drawing-qarag-md.md`: pass
- `python3` による Markdown 内容確認: seed heading 82 件、主要見出し、README リンク先の存在を確認。

## 検証計画

- `git diff --check`
- Markdown の表・リンク・主要見出しの目視確認
- 可能なら `pre-commit run --files <changed-files>`

## PR レビュー観点

- Excel 管理に戻る依存を残していないこと。
- seed QA の出典、未確認事項、回答不能評価の扱いが曖昧になっていないこと。
- benchmark 期待語句や dataset 固有分岐を実装へ入れていないこと。
- 実施していない検証を PR 本文やコメントで実施済み扱いしないこと。

## リスク

- Excel からの機械変換は xlsx 内部 XML の解析に依存するため、セル書式や入力規則は Markdown に完全再現しない。
- ユーザー提示メモの外部リンクは、今回のローカル作業では再調査しない限り最新性を保証しない。
