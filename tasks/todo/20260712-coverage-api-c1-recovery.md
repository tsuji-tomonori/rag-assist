# API C1 coverage を 85% へ回復する

- 状態: todo
- 起票日: 2026-07-12
- 背景: API の全テスト集合を一意な recursive glob に統一した時点で、C0・functions・lines は blocking gate として維持できる一方、C1 は 85% に未達である。過去の改善 task は完了済みのため、現在の差分を新しい task として追跡する。

## 受け入れ条件

- [ ] `npm run test:coverage -w @memorag-mvp/api` の C1 branches が 85% 以上になる。
- [ ] C1 改善のために本番分岐を削除・無効化したり、dataset 固有分岐を追加したりしない。
- [ ] C0 statements、functions、lines の 90% blocking gate を維持する。
- [ ] 追加テストが認証・認可境界、RAG 根拠性、失敗時の fail-closed 挙動を弱めていないことをレビューする。
- [ ] 実測値と実行コマンドを作業レポートおよび PR に記録する。
