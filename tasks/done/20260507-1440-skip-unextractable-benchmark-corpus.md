# 抽出不能 benchmark corpus の skip 対応

状態: done

## 背景

Allganize managed benchmark suite の CodeBuild 実行で、`foodkaku5.pdf` の取り込みが `Uploaded document did not contain extractable text` を返し、corpus seed 中に runner 全体が失敗した。

## 目的

抽出不能な PDF が混在しても benchmark runner が即時失敗せず、該当 corpus とそれに依存する dataset row を明示的に skip して残りを評価できるようにする。

## 範囲

- `memorag-bedrock-mvp/benchmark` の corpus seed と runner 対象 row 選択
- skip 内容の summary / report 反映
- 対象 unit test の追加または更新
- 必要最小限のドキュメント・作業レポート更新

## 計画

1. benchmark corpus seed と dataset row の関連付けを確認する。
2. 抽出不能 upload 失敗を識別して skipped corpus として返す。
3. skipped corpus に紐づく row を実行対象から除外し、summary/report に記録する。
4. 対象テストを追加し、関連検証を実行する。
5. 作業レポート、commit、PR、PR コメントまで行う。

## ドキュメント保守方針

runner の出力仕様または managed suite の挙動が変わる場合は、関連 README / docs を確認し、必要なら同じ PR で更新する。恒久ドキュメント更新が不要な場合は理由を作業レポートに記録する。

## 受け入れ条件

- 抽出可能テキストがない corpus upload で benchmark runner が throw して終了しない。
- skip された corpus の `fileName` と理由が summary または report から確認できる。
- skip された corpus に依存する dataset row は評価対象から除外され、成功・失敗件数に混入しない。
- 抽出不能以外の upload / ingest エラーは従来どおり失敗として扱われる。
- 変更範囲に見合うテストと `git diff --check` を実行し、結果を記録する。

## 検証計画

- `npm --prefix memorag-bedrock-mvp run test -w @memorag-mvp/benchmark`
- `git diff --check`
- 必要に応じて targeted TypeScript / sample benchmark 検証

## PR レビュー観点

- benchmark 固有値や QA sample 固有値に過度に依存していないこと
- 抽出不能文書だけを skip し、その他の異常を握りつぶしていないこと
- docs と実装が同期していること
- 未実施検証を実施済みとして書かないこと

## リスク

- 抽出不能エラーの表現が API 側で変わると skip 判定できない可能性がある。
- corpus skip により対象 row 数が減るため、summary の読み手に skip 件数が明示される必要がある。
