# CodeBuild conversation benchmark corpus fix

状態: done

## 背景

CodeBuild benchmark の `mtrag-v1` 実行で `benchmark/corpus/mtrag-v1` が存在せず、`seedBenchmarkCorpus()` の `scandir` が `ENOENT` で失敗した。

## 目的

CodeBuild の conversation benchmark が、dataset だけでなく対応する corpus も runner 実行前に確実に用意できるようにする。

## 範囲

- `memorag-bedrock-mvp` の benchmark CodeBuild suite 準備処理
- conversation benchmark corpus の CDK 配置
- 関連テスト、snapshot、作業レポート、PR コメント

## 計画

1. CodeBuild suite manifest / runner の corpus 入力モデルを確認する。
2. conversation corpus を benchmark bucket に配置する CDK 定義を追加する。
3. CodeBuild suite runner が manifest から corpus S3 prefix を解決し、runner 用ディレクトリへ取得するようにする。
4. infra / benchmark の対象テストを更新する。
5. 作業レポート、commit、PR、受け入れ条件コメント、セルフレビューコメントまで完了する。

## ドキュメント保守方針

運用・API・ユーザー UI の手順変更ではなく、CodeBuild benchmark の内部入力準備の修正である。永続 docs の更新要否は差分確認後に判断し、不要な場合は作業レポートと PR に理由を書く。

## 受け入れ条件

- `mtrag-v1` の CodeBuild suite が runner 実行前に corpus を runner 用ディレクトリへ取得できる。
- `chatrag-bench-v1` の CodeBuild suite が runner 実行前に corpus を runner 用ディレクトリへ取得できる。
- runner は `benchmark/corpus/<suite>` が source checkout に存在することだけに依存しない。
- infra test / benchmark test が変更内容と同期している。
- 実 CodeBuild 再実行を実施しない場合は、未検証として PR 本文・PR コメント・作業レポートに明記する。

## 検証計画

- `npm --prefix memorag-bedrock-mvp run test -w @memorag-mvp/benchmark`
- `npm --prefix memorag-bedrock-mvp run test -w @memorag-mvp/infra`
- `git diff --check`

## PR レビュー観点

- CodeBuild BuildSpec に suite 固有条件を戻していないこと。
- benchmark bucket の read/write 権限が corpus download に必要十分であること。
- RAG の根拠性・認可境界を弱めていないこと。
- benchmark expected phrase や dataset 固有分岐を本番 API 実装に入れていないこと。

## リスク

- 実 AWS CodeBuild の再実行はローカル検証では代替できないため、未実施の場合は残リスクとして明記する。
