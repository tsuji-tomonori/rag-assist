# フォルダ作成モーダルと権限分離の修正 作業レポート

## 指示

- ユーザー提供の `rag-assist-folder-modal-fix.patch` の内容を踏まえ、フォルダ作成と文書アップロードの UI・権限混同を修正する。
- `rag:group:create` と `rag:group:assign_manager` を Web UI の権限判定へ反映する。
- `+` ボタンをフォルダ作成導線へ変更し、アップロードを別ボタンへ分離する。
- 右側常設設定パネルを廃止し、必要時だけ開くモーダルにする。
- リポジトリの worktree / task / validation / report / commit / PR flow に従う。

## 要件整理

| 要件ID | 要件 | 対応 |
|---|---|---|
| R1 | フォルダ作成を `rag:group:create` で判定する | 対応 |
| R2 | 共有・フォルダ設定を `rag:group:assign_manager` で判定する | 対応 |
| R3 | `+` をフォルダ作成にし、アップロード導線を分離する | 対応 |
| R4 | 設定パネルを常設 3 カラムからモーダルへ変更する | 対応 |
| R5 | 選択フォルダ配下の子フォルダ作成を可能にする | 対応 |
| R6 | 本番 UI に固定の架空データや未実装操作を追加しない | 対応 |
| R7 | 関連テストと docs 生成物を更新する | 対応 |

## 検討・判断

- 提供パッチは `git apply --check` で `corrupt patch at line 27` となったため、そのまま適用せず、現行 `origin/main` のコードへ意図を手動反映した。
- 既存の `DocumentDetailPanel` はフォーム群を多く持つため、フォームを大きく分割せず、既存コンポーネントをモーダル内に移す形で変更範囲を抑えた。
- アップロード導線は一覧ヘッダーの独立ボタンから設定モーダルを開き、モーダル内のファイル入力とアップロード submit を使う形にした。
- UI インベントリ生成物は `docs:web-inventory:check` が差分を検出したため、`npm run docs:web-inventory` で更新した。

## 実施作業

- `usePermissions` に `canCreateDocumentGroups` と `canShareDocumentGroups` を追加し、文書管理画面の表示条件にも含めた。
- `useDocuments` のフォルダ作成 guard を `canCreateDocumentGroups`、フォルダ更新・共有 guard を `canShareDocumentGroups` へ変更した。
- `DocumentWorkspace` を 2 カラム構成にし、設定フォーム群を `folderSettingsOpen` のモーダル表示に変更した。
- `DocumentFilePanel` のショートカットを、新規フォルダ、アップロード、フォルダ設定の独立ボタンへ変更した。
- `DocumentDetailPanel` の create/share/update フォーム disabled 条件を新しい権限へ合わせた。
- `DocumentWorkspace.test.tsx` と `useDocuments.test.ts` を新しい権限・モーダル導線に合わせて更新した。
- `docs/generated/*` の Web UI インベントリ生成物を更新した。

## 成果物

| 成果物 | 内容 |
|---|---|
| `apps/web/src/app/hooks/usePermissions.ts` | フォルダ作成・共有権限を追加 |
| `apps/web/src/features/documents/hooks/useDocuments.ts` | API 操作 guard を権限別に分離 |
| `apps/web/src/features/documents/components/DocumentWorkspace.tsx` | 設定モーダルと操作導線を実装 |
| `apps/web/src/features/documents/components/workspace/DocumentFilePanel.tsx` | `+` とアップロードと設定ボタンを分離 |
| `apps/web/src/features/documents/components/workspace/DocumentDetailPanel.tsx` | フォーム権限を create/share に分離 |
| `apps/web/src/styles/features/documents.css`, `apps/web/src/styles/responsive.css` | 2 カラム化とモーダル styling |
| `docs/generated/*` | Web UI インベントリ再生成 |
| `tasks/do/20260517-1936-folder-modal-permission-fix.md` | task md |

## 検証

### 実行した検証

- `npm ci`: pass
- `npm run test -w @memorag-mvp/web -- DocumentWorkspace`: pass
- `npm run test -w @memorag-mvp/web -- useDocuments`: pass
- `npm run test -w @memorag-mvp/web -- useAppShellState`: pass
- `npm run typecheck -w @memorag-mvp/web`: pass
- `npm run docs:web-inventory:check`: fail -> `npm run docs:web-inventory` 後 pass
- `git diff --check`: pass

### 未実施・制約

- ブラウザによる手動操作確認は未実施。対象変更は React Testing Library の操作テストと型チェックで確認した。
- E2E は未実施。今回の変更は文書管理 UI 内の targeted unit/component test でカバーした。

## Fit 評価

総合fit: 4.7 / 5.0（約94%）

理由: 主要な権限分離、UI 導線分離、モーダル化、関連テスト、生成 docs 更新まで対応した。提供パッチは破損しており直接適用できなかったため手動反映した点と、ブラウザ手動確認・E2E は未実施である点を減点した。

## リスク

- 設定モーダル内に既存フォーム群を集約したため、実ブラウザでのスクロール感やフォーカス制御は追加の visual/e2e 確認余地がある。
- `rag:group:assign_manager` をフォルダ更新にも使う整理は、ユーザー提供の分析と API 権限に合わせたもの。将来、rename/move と manager assign をより細分化する場合は追加権限が必要になる。
