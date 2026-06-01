# ファイル共有モーダル load failure guard 修正 作業レポート

## 受けた指示

- PR #331 の再レビューで Request changes となった blocking 指摘を修正する。
- 共有情報ロード失敗時に空 grants で `PUT /documents/{id}/share` を呼び、既存 direct grants を削除し得る事故を防ぐ。
- `documentShareInfo === null` のとき保存不可にし、ロード失敗 alert と submit handler guard を追加する。
- UT-UI-DOC-SHARE-LOAD-FAIL-001〜004 を満たす UI 単体テストを追加する。

## 要件整理

| 要件ID | 要件 | 対応状況 |
|---|---|---|
| R1 | 共有情報取得失敗時に alert を表示する | 対応 |
| R2 | 共有情報取得失敗時に保存ボタンを disabled にする | 対応 |
| R3 | 共有情報未取得時に submit handler から保存しない | 対応 |
| R4 | 取得失敗後の再オープン成功で通常保存できる | 対応 |
| R5 | 空 grants 誤送信を回帰テストで防ぐ | 対応 |
| R6 | 変更範囲に見合う検証を実行する | 対応 |

## 検討・判断の要約

- 根本原因は、共有設定更新の前提である「現在の共有情報を正常取得済み」という条件が、保存可否と submit handler の契約に入っていなかった点と判断した。
- `documentShareInfo === null` は読み込み中にも使われるため、`documentShareLoading` と組み合わせ、読み込み完了後の `null` をロード失敗として alert 表示する方針にした。
- UI の disabled だけでは DOM 操作や実装変更時に再発し得るため、`onDocumentShareSubmit` 側にも `!documentShareInfo` guard を追加した。
- 本番 UI には架空 grants を表示せず、失敗時は明示的な error state として表示する形にした。

## 実施作業

- `apps/web/src/features/documents/components/DocumentWorkspace.tsx`
  - ロード失敗時の alert を追加。
  - 保存ボタンの disabled 条件に `documentShareInfo === null` を追加。
  - submit handler に `!documentShareInfo` guard を追加。
- `apps/web/src/features/documents/components/DocumentWorkspace.test.tsx`
  - 共有設定取得失敗時の alert / disabled テストを追加。
  - 取得失敗時に理由を入力しても保存しないテストを追加。
  - 取得失敗後に再オープン成功した場合は direct grants を表示して保存できるテストを追加。
  - 取得失敗時に `grants: []` を送信しないテストを追加。
- `docs/generated/web-accessibility.md`
- `docs/generated/web-features/documents.md`
- `docs/generated/web-ui-inventory.json`
  - UI alert 文言追加に伴い web inventory を再生成。
- `tasks/do/20260522-1127-document-share-load-fail-guard.md`
  - RCA、受け入れ条件、検証結果を記録。

## 検証

- `npm exec -w @memorag-mvp/web -- vitest run src/features/documents/components/DocumentWorkspace.test.tsx`: pass（64 tests）
- `npm run typecheck -w @memorag-mvp/web`: pass
- `npm exec -- eslint apps/web --cache --cache-location .eslintcache-web --max-warnings=0`: pass
- `npm run docs:web-inventory:check`: fail -> `npm run docs:web-inventory` 後 pass
- `git diff --check`: pass
- `npm exec -w @memorag-mvp/web -- vitest run --coverage`: pass（280 tests、C0 statements 91.07%、C1 branches 86.33%、functions 90.06%、lines 94.5%）

## 成果物

| 成果物 | 内容 |
|---|---|
| `apps/web/src/features/documents/components/DocumentWorkspace.tsx` | 共有情報ロード失敗時の保存防止と alert |
| `apps/web/src/features/documents/components/DocumentWorkspace.test.tsx` | load failure guard の回帰テスト |
| `docs/generated/web-*` | Web inventory 生成物 |
| `tasks/do/20260522-1127-document-share-load-fail-guard.md` | タスク記録 |

## 指示への fit 評価

総合fit: 4.7 / 5.0（約94%）

理由: blocking 指摘のロード失敗時空 grants 保存は、UI disabled と submit handler guard の両方で遮断し、提示された 4 件の UI 単体テスト条件を追加テストで固定した。PR 本文更新、PR コメント、task done 移動は commit / push 後に実施予定のため、このレポート作成時点では未完了として扱う。

## 未対応・制約・リスク

- E2E smoke は未実行。
- PR 本文更新、PR コメント、task done 移動は push 後に実施する。
- GitHub Actions のこの修正 commit に対する最終結果は push 後に確認対象となる。
