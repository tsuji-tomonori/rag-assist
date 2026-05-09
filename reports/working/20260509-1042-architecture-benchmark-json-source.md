# 建築図面 QARAG ベンチマーク JSON 正本化 作業レポート

## 受けた指示

- `memorag-bedrock-mvp/benchmark/architecture-drawing-qarag-v0.1.md` が説明用なのか、性能テストに使うのかを明確にする。
- 性能テストに使うのであれば、Markdown parse ではなく JSON 等の機械的に扱いやすい形式にする。

## 要件整理

| 要件ID | 要件 | 対応状況 |
|---|---|---|
| R1 | 性能テスト用の正本を JSON 形式で管理する | 対応 |
| R2 | runner が Markdown ではなく JSON を読む | 対応 |
| R3 | Markdown は説明・レビュー用であることを明記する | 対応 |
| R4 | JSON から 82 件の dataset row が生成されることをテストする | 対応 |
| R5 | 変更範囲に見合う検証を実行する | 対応 |

## 検討・判断の要約

- Markdown は人が読む説明・レビューには向くが、性能テストの正本として parse すると表記揺れや見出し変更に弱いため、JSON を正本にした。
- 既存 UI 実行経路の suite ID は維持し、CodeBuild runner の `prepare:architecture-drawing-qarag` が読む入力だけを JSON に切り替えた。
- 外部 PDF の download はネットワークと公開元に依存するため、unit test では mocked fetch で「参照された source だけ download する」挙動を確認した。

## 実施作業

- `memorag-bedrock-mvp/benchmark/architecture-drawing-qarag-v0.1.json` を追加し、13 件の source と 82 件の seed QA を格納。
- `memorag-bedrock-mvp/benchmark/architecture-drawing-qarag.ts` から Markdown parser を削除し、JSON schema/version/suiteId を検査して dataset JSONL と corpus を準備する実装へ変更。
- `memorag-bedrock-mvp/benchmark/architecture-drawing-qarag.test.ts` を JSON 正本ベースの 82 row 検証へ更新。
- `memorag-bedrock-mvp/README.md` と `memorag-bedrock-mvp/benchmark/architecture-drawing-qarag-v0.1.md` に、JSON が性能テスト正本で Markdown は説明用であることを追記。
- task md を更新し、受け入れ条件と検証結果を記録。

## 成果物

| 成果物 | 内容 |
|---|---|
| `memorag-bedrock-mvp/benchmark/architecture-drawing-qarag-v0.1.json` | 性能テスト用の機械処理正本 |
| `memorag-bedrock-mvp/benchmark/architecture-drawing-qarag.ts` | JSON 正本から dataset/corpus を準備する runner |
| `memorag-bedrock-mvp/benchmark/architecture-drawing-qarag.test.ts` | JSON 正本の 82 row 生成と download 対象制御のテスト |
| `memorag-bedrock-mvp/README.md` | JSON 正本と Markdown 説明文書の位置づけ |
| `memorag-bedrock-mvp/benchmark/architecture-drawing-qarag-v0.1.md` | Markdown は説明・レビュー用である旨の明記 |

## 実行した検証

- `npm --prefix memorag-bedrock-mvp run test -w @memorag-mvp/benchmark`: pass
- `npm --prefix memorag-bedrock-mvp run typecheck -w @memorag-mvp/benchmark`: pass
- `git diff --check`: pass
- `pre-commit run --files memorag-bedrock-mvp/README.md memorag-bedrock-mvp/benchmark/architecture-drawing-qarag-v0.1.md memorag-bedrock-mvp/benchmark/architecture-drawing-qarag-v0.1.json memorag-bedrock-mvp/benchmark/architecture-drawing-qarag.test.ts memorag-bedrock-mvp/benchmark/architecture-drawing-qarag.ts tasks/do/20260509-1038-architecture-benchmark-json-source.md reports/working/20260509-1042-architecture-benchmark-json-source.md`: pass

## 未実施・制約・リスク

- 実際に外部 PDF を download する `prepare:architecture-drawing-qarag` は未実施。ネットワークと公開元 URL の揺らぎに依存するため、今回の検証では mocked fetch の unit test に留めた。
- API / web / infra の再検証は未実施。既存 suite ID、UI whitelist、CodeBuild branch の挙動は変更しておらず、差分は benchmark runner と benchmark data/docs に限定されるため。
- JSON schema は軽量な runtime check に留めている。将来 seed QA の編集者が増える場合は JSON Schema 化と schema validation script の追加が望ましい。

## Fit 評価

総合fit: 4.8 / 5.0（約96%）

ユーザー指摘の核心である「性能テスト正本を Markdown parse にしない」は満たした。外部 PDF download を伴う実準備コマンドは環境依存のため未実施だが、runner の JSON 入力と dataset 生成、download 対象制御は unit test で確認済み。
