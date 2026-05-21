# PR330 main 競合解消 作業レポート

## 指示

- ユーザー指示: `競合解消して`
- 対象: PR #330 の作業ブランチ `codex/document-group-permissions-ui`
- 前提: `origin/main` 取り込み中の merge conflict を解消する。

## 要件整理

| 要件ID | 要件 | 対応 |
|---|---|---|
| R1 | merge conflict を解消する | 対応 |
| R2 | PR #330 の権限分離を維持する | 対応 |
| R3 | main 側のフォルダ設定モーダル変更と統合する | 対応 |
| R4 | 生成 docs の競合を再生成で解消する | 対応 |
| R5 | 実施した検証だけを報告する | 対応 |

## 検討・判断

- main 側で導入されたフォルダ設定モーダルを土台にし、PR #330 の `canCreateGroup` / `canShareGroup` / `canUpload` 分離を戻した。
- 既存テスト互換のため、`DocumentWorkspace` では旧 props `canWrite` / `canCreateGroups` / `canShareGroups` も受けられるよう正規化した。
- アップロードショートカットは保存先未選択時に disabled とし、実際の保存先名を title に表示する方針を維持した。
- docs/generated は手で片側採用せず、`npm run docs:web-inventory` で再生成した。

## 実施作業

- `origin/main` との競合を解消。
- 文書管理 UI の権限分離、disabled reason、フォルダ作成導線、アップロード導線を再統合。
- `useDocuments` の create-only ユーザー向け refresh failure 分離を維持。
- UI テストの旧導線期待を新しい accessible name / モーダル導線に更新。
- Web inventory docs を再生成。

## 成果物

| 成果物 | 内容 |
|---|---|
| `apps/web/src/features/documents/components/DocumentWorkspace.tsx` | 権限分離と main モーダル導線の統合 |
| `apps/web/src/features/documents/components/workspace/DocumentFilePanel.tsx` | アップロード/フォルダ作成ショートカットの accessible name と disabled reason |
| `apps/web/src/features/documents/components/workspace/DocumentDetailPanel.tsx` | 作成/アップロード disabled reason と focus ref |
| `apps/web/src/features/documents/hooks/useDocuments.ts` | 作成成功と refresh 失敗の分離 |
| `docs/generated/*` | Web inventory 再生成 |
| `tasks/done/20260521-1338-pr330-main-conflict-resolution.md` | 作業タスク記録 |

## 実行した検証

- `npm run typecheck -w @memorag-mvp/web`: pass
- `npm run test -w @memorag-mvp/web -- DocumentWorkspace.test.tsx useDocuments.test.ts App.test.tsx`: pass
- `npm run typecheck -w @memorag-mvp/api`: pass
- `npm run test -w @memorag-mvp/api -- api-contract.test.ts`: pass
- `npm exec -- eslint apps/web --cache --cache-location .eslintcache-web --max-warnings=0`: pass
- `npm exec -- eslint apps/api --cache --cache-location .eslintcache-api --max-warnings=0`: pass
- `npm run docs:web-inventory:check`: pass

## 未対応・制約・リスク

- coverage guard は未実行。競合解消としては対象テスト、型チェック、lint、docs check を優先した。
- GitHub Actions の最終状態は push 後に確認が必要。

## Fit 評価

総合fit: 4.6 / 5.0（約92%）

理由: 競合解消、実装統合、生成 docs 更新、主要検証は完了。coverage guard と PR CI の最終確認は push 後になるため満点ではない。
