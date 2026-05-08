# Web coverage CI 修正レポート

## 受けた指示

- PR #192 の MemoRAG CI 結果で Web Test が失敗しているため、原因を確認して修正する。

## 原因

- Web のテスト本体は pass していたが、coverage 実行時の C1 branches が 84.56% で、CI の閾値 85% を下回っていた。
- 新規追加した資料グループ UI、`useDocuments` の group/chat scope 分岐、`useChatSession` の group + temporary scope 分岐が十分にテストされていなかった。

## 実施作業

- `DocumentWorkspace.test.tsx` に、フォルダ表示、保存先フォルダ選択、フォルダ作成、共有更新の操作テストを追加した。
- `useDocuments.test.ts` に、資料グループ取得、group scope upload、chatAttachment 一時添付、create/share group の hook テストを追加した。
- `useChatSession.test.ts` に、選択フォルダと一時添付を `searchScope` に含めるテストを追加した。

## 検証

- `npm --prefix memorag-bedrock-mvp run test -w @memorag-mvp/web -- src/features/documents/components/DocumentWorkspace.test.tsx src/features/documents/hooks/useDocuments.test.ts src/features/chat/hooks/useChatSession.test.ts`: 成功。3 files / 23 tests。
- `npm --prefix memorag-bedrock-mvp run typecheck -w @memorag-mvp/web`: 成功。
- `npm exec -w @memorag-mvp/web -- vitest run --coverage`: 成功。27 files / 166 tests、C0 statements 91.96%、C1 branches 85.59%。
- `git diff --check`: 成功。

## 未対応・制約・リスク

- API/infra/benchmark は今回の修正対象外で、追加実行していない。
- CI の再実行結果は push 後に GitHub Actions 側で確認する。
