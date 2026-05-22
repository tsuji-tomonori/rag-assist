# ファイル共有モーダル stale state 修正

- 状態: done
- タスク種別: 修正
- 対象 PR: https://github.com/tsuji-tomonori/rag-assist/pull/331

## 背景

PR #331 の再レビューで、ファイル共有モーダルに前回対象文書の direct grants が一時的に残り、別文書へ誤適用され得る blocking 指摘を受けた。

## 目的

共有モーダルの open/close と非同期 load 完了時の state を安全化し、別文書の grants が表示・保存されないようにする。

## スコープ

- Web の DocumentWorkspace 共有モーダル state 管理
- stale state 回帰を防ぐ UI 単体テスト
- PR 本文の API route 記述修正
- 作業レポート、PR コメント、task 状態更新

## なぜなぜ分析サマリ

- 問題文: docA の共有モーダルを閉じた後に docB の共有モーダルを開くと、docB の share info 読み込み完了前に docA の draft grants が残り、docB に保存される可能性がある。
- 確認済み事実:
  - 再レビューで `openDocumentShare` が先に target を設定し、その後 `onLoadDocumentShare` 完了時に draft grants を更新する構造が指摘された。
  - 保存処理は現在の `documentShareTarget.documentId` と現在の `documentShareDraftGrants` を使う。
  - 共有設定は権限・可視範囲に関わるため、短時間の UI race でも merge 前に遮断すべき。
- 推定原因:
  - open/close 時に共有関連 state を一括初期化していない。
  - share info loading 中に保存操作を明示的に禁止していない。
  - 遅延レスポンスが現在 target と一致する場合だけ反映される保証が不足している。
- 根本原因:
  - 共有モーダルの target、draft grants、load lifecycle が単一の安全な状態遷移として扱われておらず、文書切替時の stale data を UI と submit の両方で遮断する設計になっていなかった。
- 対応方針:
  - open/close 時に共有関連 state を初期化する。
  - `documentShareLoading` を追加し、読み込み中は grants を空表示にして保存ボタンを disabled にする。
  - load 完了時は要求した documentId が現在 target と一致する場合だけ反映する。
  - stale grants 表示・保存・遅延レスポンス混入を回帰テストで固定する。

## 作業計画

1. `DocumentWorkspace` の共有モーダル state と open/close/save 処理を確認する。
2. loading state と stale response guard を実装する。
3. 再レビュー提示の UT-UI-DOC-SHARE-STALE-001〜004 を満たすテストを追加する。
4. PR 本文の API route 記述を実装に合わせる。
5. Web targeted test/typecheck/lint と `git diff --check` を実行する。
6. 作業レポートを残し、commit/push、PR コメント、task done 化を行う。

## ドキュメント保守計画

- durable docs の挙動仕様変更はないため README/docs 更新は不要見込み。
- PR 本文は API route 記述の不一致を修正する。
- 作業記録は `reports/working/` に保存する。

## 受け入れ条件

- [ ] UT-UI-DOC-SHARE-STALE-001: docB の share info 読み込み完了前に docA の `user-old` が表示されず、保存ボタンが disabled である。
- [ ] UT-UI-DOC-SHARE-STALE-002: docB の `onLoadDocumentShare` pending 中に理由を入力しても `onShareDocument` は呼ばれない。
- [ ] UT-UI-DOC-SHARE-STALE-003: docB 読み込み完了後に userB/readOnly を追加して保存すると、docB の documentId と docB 用 grants だけで `onShareDocument` が呼ばれる。
- [ ] UT-UI-DOC-SHARE-STALE-004: docA の遅延レスポンスが docB 表示後に返っても、docA の share info は docB のモーダル state に反映されない。
- [ ] PR 本文の API 記述が `GET /documents/{documentId}/share`、`PUT /documents/{documentId}/share`、`POST /documents/{documentId}/move` と一致する。
- [ ] 変更範囲に見合う Web test/typecheck/lint と `git diff --check` が pass する。
- [ ] 作業レポートを `reports/working/` に保存する。
- [ ] PR に日本語で受け入れ条件確認とセルフレビューをコメントする。

## 検証計画

- `npm exec -w @memorag-mvp/web -- vitest run src/features/documents/components/DocumentWorkspace.test.tsx`
- `npm run typecheck -w @memorag-mvp/web`
- `npm exec -- eslint apps/web --cache --cache-location .eslintcache-web --max-warnings=0`
- `git diff --check`

## PR レビュー観点

- stale grants が表示・保存されないこと。
- loading/empty state が実データ由来で、架空値や mock fallback を本番 UI に出さないこと。
- 権限・共有に関わる submit が loading 中に実行されないこと。

## リスク

- 非同期 load の競合はテストで明示的に固定しないと再発しやすい。
- E2E smoke は別途環境準備が必要な可能性がある。

## 実施結果

- `DocumentWorkspace` のファイル共有モーダルに `documentShareLoading` と `documentShareRequestRef` を追加した。
- 共有モーダル open 時に前回の share info、draft grants、理由、入力中 principal を初期化するようにした。
- 共有モーダル close と保存成功時に関連 state と request ref を一括クリアするようにした。
- share info 読み込み中は直接共有リストを loading 表示にし、保存ボタンを disabled にした。
- share info の非同期レスポンスは、要求した documentId が現在の request ref と一致する場合だけ反映するようにした。
- UT-UI-DOC-SHARE-STALE-001〜004 相当の回帰テストを追加した。
- web inventory を再生成した。

## 検証結果

- `npm exec -w @memorag-mvp/web -- vitest run src/features/documents/components/DocumentWorkspace.test.tsx`: pass（60 tests）
- `npm run typecheck -w @memorag-mvp/web`: pass
- `npm exec -- eslint apps/web --cache --cache-location .eslintcache-web --max-warnings=0`: pass
- `npm run docs:web-inventory:check`: fail -> `npm run docs:web-inventory` 後 pass
- `git diff --check`: pass
- `npm exec -w @memorag-mvp/web -- vitest run --coverage`: pass（276 tests、C0 statements 91.07%、C1 branches 86.22%、functions 90.06%、lines 94.5%）

## 受け入れ条件確認

- [x] UT-UI-DOC-SHARE-STALE-001: docB の share info 読み込み完了前に docA の `user-old` が表示されず、保存ボタンが disabled である。根拠: 追加テスト「共有モーダルで別文書を開いた直後に前回の直接共有を表示せず保存を無効化する」。
- [x] UT-UI-DOC-SHARE-STALE-002: docB の `onLoadDocumentShare` pending 中に理由を入力しても `onShareDocument` は呼ばれない。根拠: 追加テスト「共有モーダルの読み込み中に理由を入力しても保存しない」。
- [x] UT-UI-DOC-SHARE-STALE-003: docB 読み込み完了後に userB/readOnly を追加して保存すると、docB の documentId と docB 用 grants だけで `onShareDocument` が呼ばれる。根拠: 追加テスト「共有モーダルは読み込み完了後に現在文書の grants だけを保存する」。
- [x] UT-UI-DOC-SHARE-STALE-004: docA の遅延レスポンスが docB 表示後に返っても、docA の share info は docB のモーダル state に反映されない。根拠: 追加テスト「共有モーダルは前文書の遅延レスポンスを現在文書に反映しない」。
- [x] PR 本文の API 記述が `GET /documents/{documentId}/share`、`PUT /documents/{documentId}/share`、`POST /documents/{documentId}/move` と一致する。根拠: GitHub App で PR 本文を更新済み。
- [x] 変更範囲に見合う Web test/typecheck/lint と `git diff --check` が pass する。根拠: 上記検証結果。
- [x] 作業レポートを `reports/working/` に保存する。根拠: `reports/working/20260522-0923-document-share-stale-state-fix.md`。
- [x] PR に日本語で受け入れ条件確認とセルフレビューをコメントする。根拠: PR #331 に受け入れ条件確認コメントとセルフレビューコメントを投稿済み。

## PR コメント結果

- 受け入れ条件確認コメント: 投稿済み
- セルフレビューコメント: 投稿済み
- PR 本文更新: API route 記述、stale grants race 修正、最新検証結果、作業レポートを反映済み
