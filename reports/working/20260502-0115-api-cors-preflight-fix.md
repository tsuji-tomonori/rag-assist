# 作業完了レポート

保存先: `reports/working/20260502-0115-api-cors-preflight-fix.md`

## 1. 受けた指示

- `Failed to fetch` と CORS preflight 失敗の原因を調査する。
- worktree を作成したうえで修正する。
- 変更を git commit し、main 向け PR を作成する。

## 2. 要件整理

| 要件ID | 指示・要件 | 重要度 | 対応状況 |
|---|---|---:|---|
| R1 | 既存 checkout を汚さず worktree で作業する | 高 | 対応 |
| R2 | CORS preflight 失敗の原因を調査する | 高 | 対応 |
| R3 | 原因に対する修正を実装する | 高 | 対応 |
| R4 | 関連テストで回帰を防ぐ | 高 | 対応 |
| R5 | commit と main 向け PR 作成を行う | 高 | 対応 |

## 3. 検討・判断したこと

- ブラウザログの `Response to preflight request doesn't pass access control check` は、実 API の `OPTIONS` が 2xx ではないことを示すため、API Gateway のルート認可設定を優先して確認した。
- 実 API に対する `OPTIONS /documents`、`/questions`、`/debug-runs`、`/chat` は CORS ヘッダーを返す一方で `401 Unauthorized` となり、preflight として失敗する状態だった。
- CDK で `ANY /{proxy+}` と `ANY /` に JWT authorizer を付与しているため、明示的な未認証 `OPTIONS` ルートを追加して route selection で preflight を先に処理させる方針を採用した。

## 4. 実施した作業

- `/tmp/rag-assist-cors-preflight` に `codex/fix-api-cors-preflight` worktree を作成した。
- `memorag-bedrock-mvp/infra/lib/memorag-mvp-stack.ts` に `OPTIONS /{proxy+}` と `OPTIONS /` の未認証 Lambda 統合ルートを追加した。
- `memorag-bedrock-mvp/infra/test/memorag-mvp-stack.test.ts` に preflight ルートが `AuthorizationType: "NONE"` で、通常の `ANY` ルートは JWT のままであることを確認するテストを追加した。
- CDK snapshot を更新した。

## 5. 成果物

| 成果物 | 形式 | 内容 | 指示との対応 |
|---|---|---|---|
| `memorag-bedrock-mvp/infra/lib/memorag-mvp-stack.ts` | TypeScript | 未認証 preflight ルートの追加 | CORS 失敗修正 |
| `memorag-bedrock-mvp/infra/test/memorag-mvp-stack.test.ts` | TypeScript | preflight 認可設定の回帰テスト | 回帰防止 |
| `memorag-bedrock-mvp/infra/test/__snapshots__/memorag-mvp-stack.snapshot.json` | JSON | 合成済み CloudFormation snapshot 更新 | IaC 差分反映 |
| `reports/working/20260502-0115-api-cors-preflight-fix.md` | Markdown | 本作業の完了レポート | レポート要件 |

## 6. 指示へのfit評価

| 評価軸 | 評価 | 理由 |
|---|---:|---|
| 指示網羅性 | 4.8/5 | 調査、worktree、修正、検証、commit、PR 作成まで対応した。 |
| 制約遵守 | 5/5 | リポジトリ指定 skill と worktree 前提に沿った。 |
| 成果物品質 | 4.5/5 | IaC と snapshot、回帰テストをそろえた。 |
| 説明責任 | 4.5/5 | 実 API で確認した 401 preflight を原因として明記した。 |
| 検収容易性 | 4.5/5 | 変更ファイルと検証コマンドを分離して確認できる。 |

総合fit: 4.7 / 5.0（約94%）

理由: 主要要件は満たした。実デプロイ後の本番 API 再確認は、PR merge/deploy 後に別途必要。

## 7. 確認内容

- `curl -i -X OPTIONS https://qy11blu7ag.execute-api.us-east-1.amazonaws.com/documents ...` が `401 Unauthorized` を返すことを確認。
- `curl -i -X OPTIONS https://qy11blu7ag.execute-api.us-east-1.amazonaws.com/questions ...` が `401 Unauthorized` を返すことを確認。
- `curl -i -X OPTIONS https://qy11blu7ag.execute-api.us-east-1.amazonaws.com/debug-runs ...` が `401 Unauthorized` を返すことを確認。
- `curl -i -X OPTIONS https://qy11blu7ag.execute-api.us-east-1.amazonaws.com/chat ...` が `401 Unauthorized` を返すことを確認。
- `npm --prefix memorag-bedrock-mvp/infra run test`
- `npm --prefix memorag-bedrock-mvp/apps/api run typecheck`
- ローカル API で `OPTIONS /documents` が `204 No Content` と CORS ヘッダーを返すことを確認。
- draft PR: https://github.com/tsuji-tomonori/rag-assist/pull/35

## 8. 未対応・制約・リスク

- PR merge/deploy 後の本番 API に対する再 `OPTIONS` 確認は未実施。
- ローカル `gh` の GitHub CLI 認証トークンは無効だったため、PR は GitHub app で作成した。
- ツール制約により PR ラベルは未付与。PR 本文では `semver:patch` を指定した。
