# Web アクセシビリティメタデータ一覧

> 自動生成: `tools/web-inventory/generate-web-inventory.mjs`
>
> 静的解析による推定を含みます。条件付き表示、権限別表示、実行時データ依存の UI は certainty を確認してください。
>
> 読み方: `confirmed` はコードから直接確認できた情報、`inferred` は fallback や構造から推定した情報、`unknown` は静的解析だけでは断定できない情報です。


## 判定方針

- 対象: button、link、form、input、select、textarea、summary、img/svg、handler を持つカスタム UI。
- ok: 日本語の表示テキスト、`aria-label`、`aria-labelledby`、`title`、`alt` などからアクセシブル名を推定できる。
- warning: アイコン中心、削除/停止/公開/切替など影響が大きい操作、または SVG の意味付けに追加説明が望ましい。
- missing: 操作対象なのにアクセシブル名を推定できない。
- 静的解析のため、実行時に組み立てる label や CSS による非表示制御は推定を含みます。最終判断は画面確認と支援技術での確認を併用してください。

## 機能別サマリ

| 機能 | feature | 操作要素 | ok | warning | missing | 詳細 |
| --- | --- | --- | --- | --- | --- | --- |
| 管理 | admin | 37 | 29 | 8 | 0 | [admin.md](web-features/admin.md) |
| アプリケーション枠 | app | 37 | 37 | 0 | 0 | [app.md](web-features/app.md) |
| 認証 | auth | 26 | 26 | 0 | 0 | [auth.md](web-features/auth.md) |
| 性能テスト | benchmark | 18 | 18 | 0 | 0 | [benchmark.md](web-features/benchmark.md) |
| チャット | chat | 45 | 45 | 0 | 0 | [chat.md](web-features/chat.md) |
| デバッグ | debug | 10 | 10 | 0 | 0 | [debug.md](web-features/debug.md) |
| ドキュメント | documents | 45 | 41 | 4 | 0 | [documents.md](web-features/documents.md) |
| 履歴 | history | 11 | 10 | 1 | 0 | [history.md](web-features/history.md) |
| 担当者対応 | questions | 21 | 21 | 0 | 0 | [questions.md](web-features/questions.md) |
| 共通 | shared | 1 | 1 | 0 | 0 | [shared.md](web-features/shared.md) |

## 注意・不足候補

| 機能 | コンポーネント | 要素 | ラベル | アクセシブル名 | 説明参照 | 状態 | 理由 | 場所 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 管理 | AliasAdminPanel | button | loading && <LoadingSpinner className="button-spinner" /> / 公開 | loading && <LoadingSpinner className="button-spinner" /> / 公開 (visible-text) | - | disabled=!canPublish \|\| loading | warning: 削除、停止、公開、切替などの影響が大きい操作は対象や影響が分かる日本語メタデータを推奨します。 | apps/web/src/features/admin/components/AdminWorkspace.tsx:405 |
| 管理 | AliasAdminPanel | button | loading && <LoadingSpinner className="button-spinner" /> / 承認 | loading && <LoadingSpinner className="button-spinner" /> / 承認 (visible-text) | - | disabled=!canReview \|\| loading \|\| alias.status === "disabled" | warning: 削除、停止、公開、切替などの影響が大きい操作は対象や影響が分かる日本語メタデータを推奨します。 | apps/web/src/features/admin/components/AdminWorkspace.tsx:449 |
| 管理 | AliasAdminPanel | button | loading && <LoadingSpinner className="button-spinner" /> / 差戻 | loading && <LoadingSpinner className="button-spinner" /> / 差戻 (visible-text) | - | disabled=!canReview \|\| loading \|\| alias.status === "disabled" | warning: 削除、停止、公開、切替などの影響が大きい操作は対象や影響が分かる日本語メタデータを推奨します。 | apps/web/src/features/admin/components/AdminWorkspace.tsx:453 |
| 管理 | AliasAdminPanel | button | loading && <LoadingSpinner className="button-spinner" /> / 無効 | loading && <LoadingSpinner className="button-spinner" /> / 無効 (visible-text) | - | disabled=!canDisable \|\| loading \|\| alias.status === "disabled" | warning: 削除、停止、公開、切替などの影響が大きい操作は対象や影響が分かる日本語メタデータを推奨します。 | apps/web/src/features/admin/components/AdminWorkspace.tsx:457 |
| 管理 | ManagedUserRow | button | loading && <LoadingSpinner className="button-spinner" /> / 付与 | loading && <LoadingSpinner className="button-spinner" /> / 付与 (visible-text) | - | disabled=!canAssignRoles \|\| loading \|\| user.groups.includes(selectedRole) | warning: 削除、停止、公開、切替などの影響が大きい操作は対象や影響が分かる日本語メタデータを推奨します。 | apps/web/src/features/admin/components/AdminWorkspace.tsx:581 |
| 管理 | ManagedUserRow | button | loading && <LoadingSpinner className="button-spinner" /> / 再開 | loading && <LoadingSpinner className="button-spinner" /> / 再開 (visible-text) | - | disabled=!canUnsuspend \|\| loading | warning: 削除、停止、公開、切替などの影響が大きい操作は対象や影響が分かる日本語メタデータを推奨します。 | apps/web/src/features/admin/components/AdminWorkspace.tsx:591 |
| 管理 | ManagedUserRow | button | loading && <LoadingSpinner className="button-spinner" /> / 停止 | loading && <LoadingSpinner className="button-spinner" /> / 停止 (visible-text) | - | disabled=!canSuspend \|\| loading | warning: 削除、停止、公開、切替などの影響が大きい操作は対象や影響が分かる日本語メタデータを推奨します。 | apps/web/src/features/admin/components/AdminWorkspace.tsx:596 |
| 管理 | ManagedUserRow | button | loading && <LoadingSpinner className="button-spinner" /> / 削除 | loading && <LoadingSpinner className="button-spinner" /> / 削除 (visible-text) | - | disabled=!canDelete \|\| loading | warning: 削除、停止、公開、切替などの影響が大きい操作は対象や影響が分かる日本語メタデータを推奨します。 | apps/web/src/features/admin/components/AdminWorkspace.tsx:601 |
| ドキュメント | DocumentWorkspace | button | 新規フォルダ | 新規フォルダ (title) | - | disabled=!canWrite \|\| loading | warning: アイコン中心の操作は aria-label または aria-labelledby で用途を明示してください。 | apps/web/src/features/documents/components/DocumentWorkspace.tsx:203 |
| ドキュメント | DocumentWorkspace | button | 切替 | 切替 (visible-text) | - | disabled=loading \|\| migration.status !== "staged" | warning: 削除、停止、公開、切替などの影響が大きい操作は対象や影響が分かる日本語メタデータを推奨します。 | apps/web/src/features/documents/components/DocumentWorkspace.tsx:313 |
| ドキュメント | DocumentWorkspace | button | 戻す | 戻す (visible-text) | - | disabled=loading \|\| migration.status !== "cutover" | warning: 削除、停止、公開、切替などの影響が大きい操作は対象や影響が分かる日本語メタデータを推奨します。 | apps/web/src/features/documents/components/DocumentWorkspace.tsx:314 |
| ドキュメント | DocumentWorkspace | button | 共有更新 | 共有更新 (visible-text) | - | disabled=!canWrite \|\| (!shareGroupId && !selectedGroupId) \|\| loading | warning: 削除、停止、公開、切替などの影響が大きい操作は対象や影響が分かる日本語メタデータを推奨します。 | apps/web/src/features/documents/components/DocumentWorkspace.tsx:366 |
| 履歴 | HistoryWorkspace | button | 削除 | 削除 (visible-text) | - | - | warning: 削除、停止、公開、切替などの影響が大きい操作は対象や影響が分かる日本語メタデータを推奨します。 | apps/web/src/features/history/components/HistoryWorkspace.tsx:108 |

## メタデータとして仕様書に使える情報

| 項目 | 仕様書での使い方 |
| --- | --- |
| アクセシブル名 | ボタンや入力項目を、見た目ではなく操作目的として日本語で説明する。 |
| 説明参照 | エラー、補足、リスク説明がどの UI と紐づくかを確認する。 |
| 状態属性 | 現在地、展開状態、選択状態、処理中、無効状態を画面仕様に記載する。 |
| 注意・不足候補 | PR self-review と a11y 修正タスクの入口にする。 |
