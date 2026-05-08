# タスク: group scope 認可バイパス修正

状態: done

## 受け入れ条件
- [x] group scope の document で、owner/admin/所属グループ以外は canAccessManifest が false になる
- [x] scopeType=group かつ groupIds 空配列/未指定の upload metadata は拒否される
- [x] 既存の ACL ベース metadata 判定は非 group scope で維持される
- [x] 変更箇所に対する最小テスト/型チェックを実行して成功する
