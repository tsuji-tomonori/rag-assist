# ドキュメント登録オンボーディングと文書一覧レイアウト修正 作業レポート

## 受けた指示

- 最新コードを取得したうえで、2026-07-13 に確認したドキュメント管理画面の UI/UX 改善へ対応する。
- リポジトリの Worktree Task PR Flow に従い、実装、検証、文書同期、作業レポート、commit、push、main 向け PR、受け入れ条件コメント、セルフレビューまで行う。

## 要件整理

- フォルダ0件・文書0件から、利用者が「保存先を用意」「ファイルを選択」の順で単一文書を登録できること。
- 初回の簡易フォルダ作成はルート直下・名称のみとし、request は `{ name }` に限定すること。
- 保存先候補は API 由来かつ `effectivePermission=full` のフォルダだけにし、readOnly や権限未設定を選択済みとして扱わないこと。
- 空状態を初期0件、選択フォルダ0件、絞り込み0件で区別し、回復操作を提示すること。
- 条件付き説明の有無で Grid 配置がずれず、一覧だけが残余高を使うこと。
- 設定モーダルを内容高の単一列にし、初回登録と高度な共有・管理設定を分離すること。
- キーボード、focus、accessible name/description/live region、44px級主操作、320 CSS px reflow を考慮すること。
- 本番経路に架空フォルダ、架空ユーザー、固定件数、demo fallback を追加しないこと。

## 検討・判断の要約

- スクリーンショットと最新実装を照合し、`.document-file-panel` が直下要素のDOM順へ依存していたことをレイアウト破綻の直接原因と特定した。
- 初回登録と詳細なフォルダ管理を同じ設定モーダルに置かず、文字付き主CTAと専用2段階ダイアログへ分離した。
- 簡易作成成功後は API response の実フォルダを session 内の保存先として扱うが、非同期完了後に file picker を自動起動せず、file input へ focus を移す方針とした。
- UI の候補制御は認可の代替とせず、既存 API・hook の認可境界と request schema を変更しない方針とした。
- 作業開始後に `origin/main` が3コミット進んだため、docs 正規構成の最新 commit `964c3a98` を履歴改変なしの merge で取り込んだ。`FR-001/002` の競合は最新の参照元パスと今回の受け入れ条件を両立して解消した。
- 最終セルフレビューで readOnly の現在フォルダがダイアログ内だけ「選択済み」に見える不整合を検出し、未選択表示へ修正して回帰テストを追加した。

## 実施作業

- `DocumentAddDialog` を追加し、既存 full 権限フォルダの選択、名称のみのルートフォルダ作成、単一ファイル選択、アップロード進捗、完了後操作、inline error を一つの流れにまとめた。
- ダイアログへ初期 focus、Tab focus trap、document-level Escape、close 後の focus 復元を実装した。
- 文書一覧の主操作を文字付き `ドキュメントを追加` へ統一し、意味の重複する icon-only shortcut を整理した。
- Grid に named area を設定し、header/filter/table/footer/migration の配置を固定した。
- 初期0件、選択フォルダ0件、絞り込み0件の表示と回復導線を分離した。
- 設定モーダルを単一列・内容高に変更し、短い card の不要な stretch を解消した。
- upload アイコンを上向き矢印へ変更し、upload/settings の意味を揃えた。
- 320px 以下を含む responsive CSS を追加した。
- component test を更新し、初回作成からアップロード、name-only payload、focus、Escape、権限候補、空状態、filter reset を検証した。
- `FR-001` と `FR-002` の要件本文、専用受け入れ条件、要求属性、妥当性確認、関連文書を更新した。
- Web UI inventory を再生成した。

## 成果物

- `apps/web/src/features/documents/components/workspace/DocumentAddDialog.tsx`
- `apps/web/src/features/documents/components/DocumentWorkspace.tsx`
- `apps/web/src/features/documents/components/workspace/DocumentFilePanel.tsx`
- `apps/web/src/features/documents/components/workspace/DocumentDetailPanel.tsx`
- `apps/web/src/features/documents/components/DocumentWorkspace.test.tsx`
- `apps/web/src/shared/components/Icon.tsx`
- `apps/web/src/styles/features/documents.css`
- `apps/web/src/styles/responsive.css`
- `docs/1_要求_REQ/11_製品要求_PRODUCT/01_機能要求_FUNCTIONAL/01_文書・知識ベース管理/01_文書登録/REQ_FUNCTIONAL_001.md`
- `docs/1_要求_REQ/11_製品要求_PRODUCT/01_機能要求_FUNCTIONAL/01_文書・知識ベース管理/02_文書のQA利用可能化/REQ_FUNCTIONAL_002.md`
- `docs/generated/web-*.md`、`docs/generated/web-features/*.md`、`docs/generated/web-ui-inventory.json` の関連生成物
- `tasks/done/20260714-0033-document-upload-onboarding.md`

## 検証結果

- `npm test -w @memorag-mvp/web -- src/features/documents/components/DocumentWorkspace.test.tsx`: pass、65 tests。
- `npm run lint`: pass。
- `npm run typecheck -w @memorag-mvp/web`: pass。
- `npm run build -w @memorag-mvp/web`: pass、148 modules transformed。
- `npm run docs:web-inventory`: pass、生成物を更新。
- `task docs:check`: pass。
  - `python3 scripts/validate_docs.py`: pass。
  - `npm run docs:openapi:check`: pass。
  - `npm run docs:web-inventory:check`: pass。
  - `npm run docs:infra-inventory:check`: pass。
  - `npm run docs:hidden-unicode:check`: pass。
- `git diff --check`: pass。
- `pre-commit run --files <changed-files>`: pass。
- ローカル headless Chrome 手動確認: pass。
  - デスクトップ幅で初期空状態、追加ダイアログ、設定モーダルを確認した。
  - 320 CSS px 幅でダイアログを確認し、`dialogScrollWidth=302`、`bodyScrollWidth=320`、`viewportWidth=320` で通常ページの横スクロールがないことを確認した。
  - 表示確認はローカル mock response のみを使用し、production または外部データは変更していない。

## 指示への fit 評価

- 最新コード: `origin/main` `964c3a98` を作業ブランチへ統合し、統合後に全検証を再実行した。
- 初回登録: 名称のみの保存先作成から単一ファイルアップロードまで component test と手動表示で確認した。
- 権限境界: full 権限の API 由来候補だけを選択可能にし、readOnly/権限未設定は未選択として扱った。API 認可は変更していない。
- レイアウト: named area と単一列設定モーダルで、条件付き要素と card stretch の原因を構造的に除去した。
- accessibility/responsive: label、description、live region、focus trap、Escape、focus 復元、320px reflow を確認した。
- mock 排除: 本番 component の fallback へ架空データを追加していない。
- docs 同期: `FR-001/002` と生成 Web inventory を実装へ同期した。

## ドキュメント影響判断

- 更新: `FR-001`、`FR-002`、Web UI inventory。
- 更新不要: root `README.md`。高レベルの機能一覧・利用開始条件は変わらず、今回の変更は既存ドキュメント管理機能内の操作導線具体化であるため。
- 更新不要: API design、OpenAPI、API example。endpoint、request/response schema、status code を変更していないため。
- 更新不要: architecture、operations、monitoring、deploy docs、環境変数。runtime 構成、RAG pipeline、監視、deploy 手順を変更していないため。

## 未対応・制約・リスク

- VoiceOver/NVDA の実機読み上げ、実スマートフォン、400% zoom、仮想キーボードは未検証。semantic test と headless browser の focus/reflow 確認で補完したが、実支援技術の読み上げ順は残存確認事項である。
- 手動ブラウザ確認は mock API response を用いており、実 backend との end-to-end upload は未実施。API/hook 契約は変更せず、component test と既存 hook test の境界で検証した。
- `Validate Semver Label` の最新runは成功。task完了更新前の `MemoRAG CI` は実行中であり、成功扱いにしていない。
- RAG の検索、根拠性、引用、benchmark dataset は変更していない。benchmark 期待語句、QA sample 固有値、dataset 固有分岐は追加していない。

## 初回 PR・完了状態

- PR: `https://github.com/tsuji-tomonori/rag-assist/pull/346`（draft、`semver:patch`、mergeable）。
- 受け入れ条件コメント: PR comment ID `4960218666`。AC1〜AC13を13/13達成として記録した。
- セルフレビュー: PR comment ID `4960218498`。blocking / should fix なし、実支援技術・実端末・実backend E2Eと実行中CIを明示した。
- task: `tasks/done/20260714-0033-document-upload-onboarding.md` へ移動し、状態を `done` に更新した。

## 2026-07-14 latest main 再統合

- 状態: PR #341–#344 merge 後の current main へ再統合中。
- 理由: PR head `802cb9ed` は #342 merge commit `964c3a98` を基準としており、current main の認可／RAG lifecycle／generated API docs／管理画面監査を含まないため、そのまま merge しない。
- task: `tasks/do/20260714-0033-document-upload-onboarding.md` へ戻し、追加の受け入れ条件 R1–R6 を設定した。
- 方針: current main を mergeし、競合を現行 source 契約に沿って解消した後、No Mock Product UI、認可境界、docs 同期、変更範囲に見合う検証を再実行する。

### 再統合結果

- latest main: PR #344 merge commit `e540dde76b0a3e6779462182bcbd8acd75647b2d` を merge commit `ac56a31e5fc49119e1274c482fb4bd7be93a14aa` で統合した。
- 競合: `DocumentWorkspace.tsx`、`DocumentFilePanel.tsx`、component test と Web inventory を、current document capability／read-only shared view と onboarding dialog の両方を維持して解消した。Web inventory は source から再生成した。
- 追加修正: 作成直後の一時保存先より authoritative `documentGroups` permission を優先し、readOnly へ変わった場合は候補と upload を無効化した。read-only の空 response では作成 CTA、保存先、管理操作を表示しないようにした。
- No Mock Product UI: folder、permission、document、件数、状態は API/props/state または明示的 empty/error に由来し、production fallback へ架空値を追加していない。
- local validation: component test 71件、root lint、Web typecheck/build、`task docs:check`、変更対象 pre-commit、`git diff --check` が成功した。
- failure/repair: 最初の typecheck/build/docs check は親 worktree の古い contract export を参照して失敗した。専用 worktree の `npm install` で current workspace link へ同期し、再実行は全成功した。audit は 8 vulnerabilities（low 2 / moderate 1 / high 5）を報告し、自動修正はしていない。
- GitHub gate: final content head `73349367521dc2107d7421fb4bf98d8cd77b632c` の MemoRAG CI run 988 と Semver run 1442 が成功した。
- PR evidence: 受け入れ条件確認 comment `4964700050`、セルフレビュー comment `4964700132`、Draft 解除、`semver:patch` を確認した。
- task: `tasks/done/20260714-0033-document-upload-onboarding.md` へ再度移動する。task/report のみの metadata head CI と最終コメントは merge gate として別途確認する。
