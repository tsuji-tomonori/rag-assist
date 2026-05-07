# タスク

- 状態: done
- 背景: /documents/uploads 経由アップロードでサイズ上限がなく、ingest前に全量読み込みしてOOMの脆弱性がある。
- 目的: HEADで脆弱性が再現可能か確認し、最小修正でサイズ上限を導入する。

## 受け入れ条件
1. upload session応答で許容最大サイズを返す。
2. ingest前にオブジェクトサイズを検証し、上限超過時は拒否する。
3. 既存機能を壊さない最小差分で、API関連テストを実行して成功する。

## 検証計画
- npm --prefix memorag-bedrock-mvp run test -w @memorag-mvp/api
- git diff --check
