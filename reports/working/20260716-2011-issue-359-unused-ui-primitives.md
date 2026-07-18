# Issue #359 未使用 UI primitive の根拠付き削除 作業レポート

## 受けた指示

Issue #359 Phase 1c として、参照ゼロを証明できる `IconButton` / `Panel` のみを削除し、再導入防止 guard、生成 Web inventory 同期、Web / root 検証、並行 PR との競合確認、PR lifecycle まで実施する。`Badge` は `StatusBadge` の依存なので保持する。

## 要件整理

- JSX、static import、dynamic import、barrel export、旧パス、生成 docs、open PR の観点で削除可否を確認する。
- 製品 UI の表示・操作・アクセシビリティ・実データ境界を変更しない。
- 廃止 primitive のパスまたは参照が戻った場合に既存 CI 経路で失敗させる。
- ソースから生成される Web inventory / docs を同期する。
- PR #361、root shim 作業、PR #338 と競合しない範囲を優先し、残る生成物競合リスクを記録する。

## 検討・判断

### 削除根拠

`apps/web/src`、E2E、`.github/`、`packages/`、`scripts/`、`tools/`、`skills/`、canonical / generated docs を分けて検索した。`IconButton` と共通 `Panel` は各定義、`apps/web/src/shared/ui/index.ts` の export、生成 Web inventory / docs にのみ存在し、JSX、static import、dynamic import、旧パス参照は 0 件だった。このため削除対象とした。

`Badge` は `StatusBadge.tsx` が import し JSX で描画しているため削除対象外とした。guard でも export、import、JSX 実利用を確認する。

### 再発防止

既存 `npm run test:web-semantic-ui` で実行される `tools/web-inventory/semantic-ui-contract.test.mjs` に以下の契約を追加した。

- `IconButton.tsx` / `Panel.tsx` が `ENOENT` である。
- `apps/web/src` 全体に exact symbol `IconButton` / `Panel` がない。
- `shared/ui/IconButton` / `shared/ui/Panel` と `./IconButton.js` / `./Panel.js` の参照がない。
- `Badge` の barrel export と `StatusBadge` からの import / JSX 利用が残る。

### 並行作業

- PR #361 は Web quality workflow / Taskfile / package / E2E / CSS / NFR docs が中心で、本変更の製品ソース・semantic test と直接重複しない。
- `codex/issue-359-web-root-shims` は事前確認時点で差分がなく、本変更の対象ファイルとは分離している。
- PR #338 は chat / API 実装と生成 Web docs を変更している。製品ソースは重複しないが、`docs/generated/web-*.md` と `web-ui-inventory.json` は競合し得る。競合時は統合後のソースから `npm run docs:web-inventory` を再実行する必要がある。

## 実施作業

- `apps/web/src/shared/ui/IconButton.tsx` を削除した。
- `apps/web/src/shared/ui/Panel.tsx` を削除した。
- `apps/web/src/shared/ui/index.ts` から両 export を削除した。
- semantic UI contract に廃止 primitive と `Badge` 保持の guard を追加した。
- Web inventory generator を実行し、関連 generated docs / JSON を同期した。
- clean install と対象 / 全体検証を実行した。

## 成果物

- 未使用 UI primitive 2 ファイルの削除
- barrel export 整理
- 再導入防止 semantic contract test
- 最新の Web component / accessibility / inventory 生成物
- task md: `tasks/done/20260716-2002-issue-359-unused-ui-primitives.md`

## 検証結果

| コマンド | 結果 |
| --- | --- |
| `npm ci` | 成功。504 packages。既存依存監査で 8 vulnerabilities（low 2 / moderate 1 / high 5）を報告。自動修正は範囲外のため未実施。 |
| `node --test tools/web-inventory/semantic-ui-contract.test.mjs` | 成功 |
| `npm run docs:web-inventory` | 成功、生成物を同期 |
| `npm run docs:web-inventory:check` | 成功 |
| `npm run docs:web-trace:test` | 成功 |
| `npm run test:web-semantic-ui` | 成功 |
| `npm run test:coverage -w @memorag-mvp/web` | 成功。61 files / 442 tests。Statements 90.87%、Branches 85.77%、Functions 90.78%、Lines 93.70%。 |
| `npm run typecheck -w @memorag-mvp/web` | 成功 |
| `npm run build -w @memorag-mvp/web` | 成功。既存の 500 kB 超 chunk warning あり。 |
| `npm run ci` | 成功。lint、全 workspace typecheck、contract 1 / API 801 / Web 442 / infra 38 / benchmark 102 tests、全 workspace build が成功。 |
| `git diff --check` | 成功 |

## 指示への fit 評価

- `IconButton` / `Panel` は参照ゼロの証跡に限定して削除した。
- `Badge` / `StatusBadge` は保持し、guard で依存の継続を検証した。
- 製品コンポーネントの利用箇所や props、CSS、画面挙動は変更しておらず、アクセシビリティと no-mock 境界を維持した。
- 生成 docs は generator 由来の差分のみであり、canonical 仕様・API・運用 docs の更新は不要と判断した。
- root CI を含む要求検証を省略せず実行した。

## 未対応・制約・リスク

- Open PR #367 を作成し、受け入れ条件コメントとセルフレビューコメントを投稿した。全受け入れ条件を満たし、blocking 指摘なしと判定した。
- GitHub Apps による PR 作成は 122 秒以上応答停止し、成功結果を取得できなかった。対象 head の PR が未作成であることを確認してから `gh` fallback で作成した。Apps 操作は成功扱いにしていない。
- PR #338 と generated Web docs に競合可能性がある。製品ソースの意味的競合ではなく、統合順に応じた再生成で解消可能。
- `npm ci` が報告した依存脆弱性 8 件と build の chunk size warning は本変更起因ではなく、Issue #359 Phase 1c の範囲外。
- merge / deploy / release は実施しない。

## PR lifecycle

- PR: https://github.com/tsuji-tomonori/rag-assist/pull/367
- 第1コミット: `8114a8f9`
- 受け入れ条件コメント: https://github.com/tsuji-tomonori/rag-assist/pull/367#issuecomment-4991174585
- セルフレビューコメント: https://github.com/tsuji-tomonori/rag-assist/pull/367#issuecomment-4991174783
- ラベル: `semver:patch`
- PR 状態: open
- GitHub CI（第1コミット `8114a8f9`）: MemoRAG CI 成功、`semver:patch` 追加後の validate-semver-label 成功、promotion gate は仕様どおり skipped。ラベル追加前の validate-semver-label failure は後続 run で解消済み。
