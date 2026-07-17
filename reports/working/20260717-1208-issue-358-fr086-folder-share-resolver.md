# Issue #358 FR-086 folder share 監査 resolver 作業レポート

## 受けた指示

Issue #358 の残課題と open Draft PR を再確認し、重複しない最小 backend / security unit を fresh worktree で実装・検証し、日本語 Draft stacked PR、semver、受け入れ条件、セルフレビュー、最終 head CI、Issue 進捗まで完遂する。merge / deploy / release は行わず、実 AWS 未検証は明記する。

## 要件整理と選定

- 2026-07-17 時点で #386 membership、#389 group update、#391 group create、#394 group delete、#399 retry/quarantine、#401 application role resolver が FR-086 chain を構成している。
- open PR に exact `folder/share.replace` resolver はなく、producer、tenant-scoped `FolderPolicyStore.getVersionedByFolderId`、worker の既存 DocumentGroups read / object-store access が揃っている。
- folder move / delete、document share / move / delete、administrative principal は複数 projection、tombstone、別 authoritative store を伴うため、folder share を次の最小・非重複単位に選定した。

## 検討・判断

- current versioned policy のみを authoritative source とし、actor/request 値から結果を推測しない。
- audit policy entry は principal key で canonical sort する一方、duplicate、未知 enum、非 canonical identity / timestamp は拒否する。
- pending は current=proposed のみ success とし、current=before、missing、第三状態は retry/quarantine へ送る。
- durable completion は current=requested after を必須とし、success はさらに proposed state と一致させる。
- revocation success は audit intent ID に相関する durable cleanup repair、before version、authoritative deny version、全既知 cleanup target の一致を要求する。resolver 自体は policy や cleanup を変更しない。

## 実施作業と成果物

- `FolderShareAuditAuthoritativeResolver` と 8 contract tests を追加した。
- production reconciliation worker registry と static no-mutation / boundary policy を更新した。
- FR-086 requirements coverage と正本文書を同期し、未実装 resolver を open のまま明示した。
- route / OpenAPI / README / infra / operational procedure は変更していない。既存 worker IAM と dependency graph 内の read path を利用するため新規 infra 定義は不要と判断した。
- task: `tasks/do/20260717-1148-issue-358-fr086-folder-share-resolver.md`。

## 検証

- 初回 targeted test: 1 件失敗。missing current policy は before state ではなく third state であるため期待値を修正し、再実行した。
- resolver targeted: 8/8 成功。
- API full: 844/844 成功。
- API typecheck: 成功。
- `task docs:check`: 成功。OpenAPI、API docs freshness（97 APIs / 582 documents）、UI / infra inventory を含む。
- release source audit: dataset 固有分岐 0、artifact mismatch 0、audit ID `sha256:0cb39423bb1c791a6c8882d45cc235a0afaea22bc05c0a96046d028cc49aa210`。
- `task verify`: lint、全 workspace typecheck / build 成功。web build の 500 kB 超 chunk warning は既存警告として残る。
- `git diff --check`: 成功。
- `npm ci`: 成功。dependency file の変更はない。npm audit は既存 8 vulnerabilities（low 2 / moderate 1 / high 5）を報告した。
- `pre-commit run`（staged files）: 成功。初回 `--all-files` は既存レポートの末尾空白を修正して停止したため、その無関係な変更を復元して対象 files に限定した。
- GitHub final-head CI は PR lifecycle で追記する。

## 指示への fit 評価

4.8 / 5。最小の非重複 FR-086 unit を stacked base #401 上で実装し、監査収束と revocation repair の境界を自動検証した。セルフレビューで success-null と timestamp の fail-closed gap も修復した。残る 0.2 は実 AWS consistency / delivery と cleanup 実行完遂がローカルでは検証できないためである。

## 未対応・制約・リスク

- 実 AWS DynamoDB read consistency、EventBridge duplicate delivery、Lambda worker 実行は未検証。
- cleanup repair の durable evidence は確認するが、cleanup 完遂は既存 cleanup worker の責務である。
- current=before の pending intent は結果を推測せず quarantine し得る。
- folder move / delete、document share / move / delete、administrative principal resolver は後続単位である。
- stacked chain #386→#389→#391→#394→#399→#401→本 PR の順序が必要。
- merge / deploy / release は実施しない。
