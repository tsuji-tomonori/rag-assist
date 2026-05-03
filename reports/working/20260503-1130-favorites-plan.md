# 作業計画レポート

保存先: `reports/working/20260503-1130-favorites-plan.md`

## 1. 受けた指示

- `worktree` を作成して新規ブランチで作業する。
- お気に入り機能について設計、実装、テストを行う。
- ある程度きりの良いタイミングでテスト確認を行い、`git commit` と `git push` を実行する。
- すべて完了後、GitHub Apps を利用して `main` 向け PR を作成する。
- 最初に実行計画を立て、レポートを作成し、タスク分割してから一気通貫で進める。

## 2. Done 条件

- `codex/favorites` ブランチの worktree で作業している。
- 既存の API、Web UI、store、テスト構成を確認し、既存パターンに沿ってお気に入り機能を追加している。
- 必要なテスト、型チェック、または関連検証を実行し、既知の未解決失敗を残していない。
- 作業完了レポートを `reports/working/` に保存している。
- ステージ済み差分を確認し、日本語 gitmoji commit message で commit している。
- ブランチを `origin` に push し、GitHub Apps で `main` 向け PR を作成している。

## 3. タスク分割

| ID | タスク | 成果物 | 検証 |
|---|---|---|---|
| M1 | Worktree とブランチ準備 | `/home/t-tsuji/project/rag-assist-favorites`, `codex/favorites` | `git status --short --branch` |
| M2 | 既存構成調査と設計 | 実装方針、変更対象ファイル | 関連 docs とコード確認 |
| M3 | お気に入り機能実装 | API / Web / store / 型 / UI の変更 | 対象ユニットテスト |
| M4 | Docs 影響確認と必要更新 | docs または不要理由 | docs check または diff check |
| M5 | 検証と修正 | テスト結果 | 失敗時は修正して再実行 |
| M6 | 完了レポート、commit、push、PR | レポート、commit、PR | `git status`, push 結果、PR URL |

## 4. 現時点の判断

- ユーザーが対象画面やデータ種別を限定していないため、既存アプリで自然な「質問 / 履歴 / ナレッジ項目」などの主要ユーザー導線を調査し、最小で実用になるお気に入り対象を決める。
- API route や認証境界を変更する場合は、アクセス制御レビューと関連 policy test 更新を同じ作業範囲に含める。
- ローカル未追跡ファイルが元 worktree に存在するため、別 worktree で作業し、無関係な変更を stage しない。
