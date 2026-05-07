# タスク
- タイトル: ACCESS_ADMIN の SYSTEM_ADMIN 自己昇格防止
- 状態: done

## 背景
Aardvark 検知で `/admin/users/{userId}/roles` が `access:role:assign` のみで SYSTEM_ADMIN 付与を許可し、自己昇格可能な問題が報告された。

## 目的
HEAD で問題が残っているか確認し、残っていれば最小修正で封じる。

## スコープ
- `memorag-bedrock-mvp/apps/api/src/app.ts`
- 関連 API テスト

## 受け入れ条件
1. ACCESS_ADMIN が自分自身へ SYSTEM_ADMIN を付与できない。
2. SYSTEM_ADMIN は従来どおりロール付与可能。
3. 既存の role assign 正常系テストは維持される。
4. 変更に対応したテストを追加し、対象ワークスペーステストが成功する。

## 検証計画
- API workspace テスト実行（対象テストを含む）

## リスク
- 既存運用で ACCESS_ADMIN が SYSTEM_ADMIN 付与に依存していた場合の仕様差分。
