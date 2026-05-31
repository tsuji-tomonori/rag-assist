# ファイル共有モーダル stale state 修正 作業レポート

## 受けた指示

- PR #331 の再レビューで Request changes となった blocking 指摘を修正する。
- ファイル共有モーダルで前回文書の direct grants が一時的に残り、別文書へ誤共有され得る race を解消する。
- open/close 時に共有 state を初期化し、読み込み中は保存不可にする。
- UT-UI-DOC-SHARE-STALE-001〜004 を満たす UI 単体テストを追加する。
- PR 本文の API 記述を実装の `GET /documents/{documentId}/share`、`PUT /documents/{documentId}/share`、`POST /documents/{documentId}/move` に合わせる。

## 要件整理

| 要件ID | 要件 | 対応状況 |
|---|---|---|
| R1 | 前回文書の direct grants を別文書の共有モーダルに表示しない | 対応 |
| R2 | share info 読み込み中に保存できない | 対応 |
| R3 | docB 保存時に docB 用 grants だけを送る | 対応 |
| R4 | docA の遅延レスポンスを docB の state に反映しない | 対応 |
| R5 | PR 本文の API 記述を実装と一致させる | PR push 後に GitHub App で対応予定 |
| R6 | 変更範囲に見合う検証を実行する | 対応 |

## 検討・判断の要約

- 根本原因は、共有モーダルの target、draft grants、load lifecycle が一体の状態遷移として管理されておらず、文書切替時に stale data を UI 表示と submit の両方で遮断できていなかった点と判断した。
- state を消すだけでは遅延レスポンスの後勝ちを防げないため、`documentShareRequestRef` で現在の読み込み対象 documentId を保持し、一致するレスポンスだけを反映する方針にした。
- 読み込み中は grants を空にして loading 表示にし、保存ボタンを disabled にすることで、表示と submit の両方を fail-closed にした。
- durable docs の恒久仕様変更はないため、README/docs の手書き更新は不要と判断した。生成 inventory は UI テキスト追加に合わせて再生成した。

## 実施作業

- `apps/web/src/features/documents/components/DocumentWorkspace.tsx`
  - `documentShareLoading` と `documentShareRequestRef` を追加。
  - 共有モーダル open 時に share info、draft grants、理由、principal 入力、permission level を初期化。
  - close と保存成功時に共有関連 state を一括クリア。
  - 読み込み中の直接共有リストを loading 表示に変更。
  - 読み込み中の保存 submit を UI と handler の両方で無効化。
  - stale な load response を現在のモーダル state に反映しない guard を追加。
- `apps/web/src/features/documents/components/DocumentWorkspace.test.tsx`
  - UT-UI-DOC-SHARE-STALE-001〜004 相当の回帰テストを追加。
- `docs/generated/web-accessibility.md`
- `docs/generated/web-features/documents.md`
- `docs/generated/web-ui-inventory.json`
  - Web inventory を再生成。
- `tasks/do/20260522-0918-document-share-stale-state-fix.md`
  - RCA、受け入れ条件、検証結果を記録。

## 検証

- `npm exec -w @memorag-mvp/web -- vitest run src/features/documents/components/DocumentWorkspace.test.tsx`: pass（60 tests）
- `npm run typecheck -w @memorag-mvp/web`: pass
- `npm exec -- eslint apps/web --cache --cache-location .eslintcache-web --max-warnings=0`: pass
- `npm run docs:web-inventory:check`: fail -> `npm run docs:web-inventory` 後 pass
- `git diff --check`: pass
- `npm exec -w @memorag-mvp/web -- vitest run --coverage`: pass（276 tests、C0 statements 91.07%、C1 branches 86.22%、functions 90.06%、lines 94.5%）

## 成果物

| 成果物 | 内容 |
|---|---|
| `apps/web/src/features/documents/components/DocumentWorkspace.tsx` | stale grants race を遮断する共有モーダル state 管理 |
| `apps/web/src/features/documents/components/DocumentWorkspace.test.tsx` | stale state / loading / stale response の回帰テスト |
| `docs/generated/web-*` | Web inventory 生成物 |
| `tasks/do/20260522-0918-document-share-stale-state-fix.md` | タスク記録 |

## 指示への fit 評価

総合fit: 4.7 / 5.0（約94%）

理由: blocking 指摘の stale state race は UI 表示、submit、遅延レスポンスの各経路で遮断し、提示された 4 件の UI 単体テスト条件を追加テストで固定した。PR 本文更新と PR コメントは commit / push 後に GitHub App で実施予定のため、このレポート作成時点では未完了として扱う。

## 未対応・制約・リスク

- E2E smoke は未実行。
- PR 本文更新、PR コメント、task done 移動は push 後に実施する。
- GitHub Actions のこの修正 commit に対する最終結果は push 後に確認対象となる。
