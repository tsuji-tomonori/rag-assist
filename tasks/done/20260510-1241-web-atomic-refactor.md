# web Atomic Design リファクタリング

状態: done

## 背景

`rag-assist` の web 実装は feature / workspace 単位では整理されているが、Atomic Design 的な atom / molecule / organism の分割が弱く、`DocumentWorkspace`、`AdminWorkspace`、`DebugPanel`、`useAppShellState` などに責務が集中している。

## 目的

MVP の既存挙動を維持しながら、共通 UI primitive、CSS design tokens、feature container / subcomponent 分割を導入し、今後の拡張時の保守性を高める。

## スコープ

- `memorag-bedrock-mvp/apps/web/src` 配下の UI / hook / CSS の構造改善。
- `shared/ui` の最小導入。
- `AssistantAnswer`、`DebugPanel`、`DocumentWorkspace`、`AdminWorkspace` の責務分割。
- `useAppShellState` の feature container 向け責務整理。
- 必要に応じた関連テスト更新。

## 非スコープ

- API contract の変更。
- URL routing の導入。
- 新規業務機能の追加。
- 本番データや権限モデルの変更。

## 実施計画

1. web の現状ファイル、既存 test script、Taskfile / package script を確認する。
2. `shared/ui` と CSS design tokens を追加し、既存 primitive と整合させる。
3. `AssistantAnswer` を回答本文、引用、コピー、フォローアップ、確認質問、エスカレーションに分割する。
4. `DebugPanel` を replay hook、header、flow、diagnostics、expanded dialog に分割する。
5. `DocumentWorkspace` を folder / table / detail / upload / share / confirm / migration strip に分割する。
6. `AdminWorkspace` を overview / alias / user / role / usage / cost / audit に分割する。
7. `useAppShellState` から feature props assembly を container または mapper へ寄せる。
8. CSS の tokens、questions/history 分離、animation 分離を実施する。
9. 変更範囲に応じた test / typecheck / build を実行し、失敗時は修正して再実行する。
10. 作業レポートを作成し、commit / push / PR / 受け入れ条件コメント / セルフレビューまで完了する。

## ドキュメント保守計画

- API やユーザー機能の仕様は変更しない想定のため、恒久 docs 更新は原則不要。
- UI 構造や検証結果、未対応リスクは `reports/working/` の作業レポートと PR 本文に記録する。
- 実装中に README や docs と矛盾する挙動変更が発生した場合は、同じ PR で最小限更新する。

## 受け入れ条件

- [x] `shared/ui` に再利用可能な最小 UI primitive が追加され、少なくとも今回分割した UI から利用されている。
- [x] CSS に design tokens が導入され、今回触る CSS の主要な色・余白・角丸・影が token 経由になっている。
- [x] `AssistantAnswer` が複数の責務別 subcomponent に分割され、既存の回答表示・コピー・引用・フォローアップ・確認質問・エスカレーション挙動が維持されている。
- [x] `DebugPanel` が複数の責務別 component / hook に分割され、replay upload/download と expanded 表示が維持されている。
- [x] `DocumentWorkspace` が責務別 component に分割され、文書一覧・フォルダ・アップロード・共有・再インデックス・確認ダイアログの既存挙動が維持されている。
- [x] `AdminWorkspace` が責務別 component に分割され、alias / user / role / usage / cost / audit 表示の既存挙動が維持されている。
- [x] `useAppShellState` の責務が縮小され、feature props assembly が別 module または container 側へ分離されている。
- [x] 本番 UI に固定の架空データや未実装操作の見せかけを追加していない。
- [x] web の関連テスト、typecheck、build が pass している、または未実施理由が明記されている。
- [x] 作業レポート、PR の受け入れ条件コメント、セルフレビューコメントが日本語で作成されている。

## PR

- Pull Request: https://github.com/tsuji-tomonori/rag-assist/pull/239
- 受け入れ条件コメント: 投稿済み。
- セルフレビューコメント: 投稿済み。

## 実施結果

- `shared/ui` に `Button`、`IconButton`、`Badge`、`Panel`、`EmptyState`、`ConfirmDialog` を追加した。
- `AssistantAnswer` は `features/chat/components/answer/` に表示・引用・コピー・追加質問・確認質問を分割した。
- `DebugPanel` は `useDebugReplay` と `features/debug/components/panel/` の header/body/footer/dialog/utils に分割した。
- `DocumentWorkspace` は `features/documents/components/workspace/` に folder tree、file panel、detail panel、confirm dialog、utils を分割した。
- `AdminWorkspace` は `features/admin/components/panels/` に overview、alias、user、role、usage、cost、audit を分割した。
- `useAppShellState` は route props builder module を導入し、feature props assembly の一部を `app/routeProps/featureRouteProps.ts` に分離した。
- CSS は `animations.css`、`features/questions.css`、`features/history.css` を追加し、`questions-history.css` を廃止した。
- web inventory 生成物を更新した。

## 検証結果

- `npm ci`: pass。worktree 側の依存導入のため実行。
- `npm --prefix memorag-bedrock-mvp run lint`: fail -> 修正後 pass。
- `npm --prefix memorag-bedrock-mvp run typecheck -w @memorag-mvp/web`: pass。
- `npm --prefix memorag-bedrock-mvp run test -w @memorag-mvp/web`: pass。28 files / 191 tests。
- `npm --prefix memorag-bedrock-mvp run build -w @memorag-mvp/web`: fail -> CSS 分割境界修正後 pass。
- `npm --prefix memorag-bedrock-mvp run docs:web-inventory`: pass。生成物更新。
- `npm --prefix memorag-bedrock-mvp run docs:web-inventory:check`: pass。
- `git diff --check`: pass。

## 検証計画

- `git diff --check`
- `npm --prefix memorag-bedrock-mvp run typecheck -w @memorag-mvp/web`
- `npm --prefix memorag-bedrock-mvp run test -w @memorag-mvp/web`
- `npm --prefix memorag-bedrock-mvp run build -w @memorag-mvp/web`

## PR レビュー観点

- Atomic Design 的な分割が表層的なファイル移動に留まらず、責務境界を明確にしているか。
- 既存 UI の認可境界、debug trace 表示、admin 情報表示を弱めていないか。
- 変更範囲に見合う web test / typecheck / build が実行されているか。
- 固定の mock business data や demo fallback を本番 UI に追加していないか。

## リスク

- 大規模リファクタのため、既存 integration test の mock や selector と衝突する可能性がある。
- CSS 分割により画面の細かな表示差分が発生する可能性がある。
- `useAppShellState` の責務分離は影響範囲が大きいため、必要に応じて props assembly 分離に留める。
