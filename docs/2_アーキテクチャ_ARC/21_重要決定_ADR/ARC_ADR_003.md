# ADR-0003: root 化後の旧 MVP directory は stale local artifact として扱う

- ファイル: `docs/2_アーキテクチャ_ARC/21_重要決定_ADR/ARC_ADR_003.md`
- 種別: `ARC_ADR`
- 作成日: 2026-05-14
- 状態: Accepted

## Context

MemoRAG MVP の source layout は、PR #284 により `memorag-bedrock-mvp/` 配下から repository root へ移動した。

現行の正規 source path は、`apps/`、`packages/`、`docs/`、`benchmark/`、`infra/`、`tools/` などの root 直下 directory である。

一部の作業環境では、root 化前に生成された `memorag-bedrock-mvp/` 配下の `node_modules/`、`coverage/`、`dist/`、`infra/cdk.out/`、`infra/lambda-dist/`、`.local-data/` などが untracked directory として残ることがある。

## Decision

root 化後の `memorag-bedrock-mvp/` は、正規 source tree ではなく stale local artifact として扱う。

repository は `memorag-bedrock-mvp/` 全体を `.gitignore` で ignore し、root 化前の生成物や依存物が `git status` に再表示されないようにする。

旧 path に新しい source、docs、fixture、設定を追加しない。必要な変更は root 直下の現行 layout に対して行う。

ローカルに残った旧 directory の物理削除は、作業者の未追跡ファイルを消す不可逆操作であるため、通常の PR 変更としては実行しない。

## Options

| 選択肢 | 評価 |
| --- | --- |
| `memorag-bedrock-mvp/` 全体を ignore する | 採用。tracked source がなく、root 化後の正規配置と矛盾せず、untracked 生成物の再表示を防げる。 |
| 旧 directory を物理削除する | 不採用。ローカル作業環境の未追跡ファイル削除であり、PR では恒久化できず、不可逆操作になる。 |
| `infra/lambda-dist/` など旧 path の生成物だけを個別 ignore する | 不採用。旧 directory には `node_modules/`、`coverage/`、`dist/`、`.local-data/` など複数種の生成物があり、漏れが残る。 |
| 旧 directory を保持し、現行 source として扱う | 不採用。root 化済み layout と矛盾し、後続 task の参照先を混乱させる。 |

## Consequences

### Positive

- root 化後の正規 source layout が明確になる。
- 旧 path の生成物、依存物、ローカルデータが `git status` を汚染しにくくなる。
- 後続 Phase の作業者が旧 path を実装対象と誤認しにくくなる。

### Negative

- ローカル disk 使用量は `.gitignore` だけでは減らない。
- 旧 directory 配下に誤って新規ファイルを作った場合、Git が検出しないため、レビューでは root 直下 layout を前提に確認する必要がある。

## Related Requirements

- `TASK-A3-cleanup-stale-mvp-dir`: root 化後の旧 `memorag-bedrock-mvp/` 残骸処理。
- `TC-001`: 初期実装の技術境界と source layout の管理。

## Follow-up

- ローカル容量削減が必要な場合は、作業者が未追跡内容を確認したうえで `memorag-bedrock-mvp/` を削除する。
- 過去 reports の旧 path 参照は履歴として残し、現行作業の参照先は root 直下 path を使う。
