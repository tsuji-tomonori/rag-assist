# Issue #358 FR-086 administrative-principal transfer audit resolver

- 状態: do
- タスク種別: 機能追加
- 作成日: 2026-07-17
- 起点: PR #419 final head `85c75af7`
- branch: `codex/issue-358-fr086-admin-principal-transfer-resolver`
- 関連要件: `FR-086`, Issue #358

## 背景・目的

Issue #358 の production audit evidence worker は、resource 種別ごとの authoritative event/source を exact read-only resolver で復元する。folder/delete、document/move に続き、administrative principal transfer の監査証跡を、tenant 境界と non-enumeration を保った narrow port として追加する。

## 実装チェックリスト

- [x] administrative-principal transfer の current service/audit event/store と worker fallback を RCA する。
- [x] exact tenant-qualified lookup contract と non-enumeration/error semantics を定義する。
- [x] read-only resolver/adapter を production worker へ登録する。
- [x] 必要な AWS read IAM だけを付与し、write/delete/scan を追加しない。
- [x] exact hit / missing / cross-tenant / malformed / least privilege の tests を追加する。
- [x] FR-086 / DLD / OPS / infra inventory へ implementation boundary を同期する。
- [ ] selected/full validation、Draft stacked PR、semver、AC/self-review、report/task done、final-head CI、Issue #358 進捗まで完遂する。

## RCA と実装判断

- producer は `security/ownership-transfer/{tenantId}/{sourceUserId}.json` に transfer state を CAS 永続化し、folder/resource group/document の source/target snapshot と `auditIntentId` を保持する。
- audit worker には `administrativePrincipal` / `ownership.transfer` の resolver がなく、pending/finalization-pending intent は generic fallback でも authoritative state を復元できなかった。
- resolver は intent の tenant/source/policy/successor と state を照合し、origin state では audit/actor/reason も一致させる。producer が既存 state を再利用する新 audit は、durable requested completion と state/current の一致で相関する。各 ID は exact `GetItem` / tenant manifest `GetObject` で再読し、list/query/scan や mutation replay は行わない。
- pending success は state が `committed` かつ全 current record が target snapshot と一致する場合だけ、`transferring` success は durable requested completion が存在する場合だけ確定する。failed rollback は `rollback_pending` / `rolled_back` かつ全 current record が source snapshot と一致する場合だけ確定する。object key order は JSON の意味に含めず、値・配列順・field を canonical 比較する。
- state が作られる前、または別 audit の既存 state がある denied/conflict/failed は durable requested completion の after が before inventory と一致する場合だけ確定する。別 audit の producer が `reconciliationRequired: true` を付けた failed も flag 付き before と exact 一致する場合だけ確定し、partial state を success にはしない。state 不在の zero-inventory success は durable requested completion が exact zero before を保持する場合だけ確定し、requested completion のない success は fail closed とする。
- pre-fence before と fenced inventory の増減は正規 producer race であるため件数の大小を同一視せず、state 内の各 folder/resource group/document が source principal を実際に参照し、producer の target owner/admin/operation marker transitionとcurrent recordが一致することを検証する。document はmetadata/admissionの両owner channelを独立に検証する。
- worker IAM は account-qualified ownership-transfer key の `s3:GetObject` だけを追加し、既存 tenant manifest `GetObject` と DocumentGroups table `GetItem` を再利用する。`ListBucket`、write、delete は追加しない。
- durable な実装境界は canonical `FR-086` と生成 infra inventory に同期した。外部 API/UI/運用手順は変わらず、独立 DLD/OPS の重複追記は不要と判断した。actual AWS の S3/DynamoDB/EventBridge/Lambda 経路は未検証として残す。

## 受け入れ条件

- [ ] resolver は tenant ID と administrative-principal transfer の exact identity で authoritative source を読む。
- [ ] 他 tenant や存在しない transfer の情報を列挙・推測できない。
- [ ] audit worker は該当 resource/action だけを resolver に route し、既存 resolver/fallback を後退させない。
- [ ] resolver は read-only で、production IAM は必要最小限の Get/Query に限定される。
- [ ] raw principal identifier、secret、他 tenant data を不要に artifact/log へ追加しない。
- [ ] missing/cross-tenant/malformed は fail closed で、架空の success evidence を生成しない。
- [ ] RAG 根拠性、認可境界、artifact integrity を弱めない。
- [ ] benchmark 期待語句、QA sample、dataset 固有分岐を production runtime に追加しない。
- [ ] local/full/final-head CI、docs、source audit、semver、comments、clean/upstream が揃う。
- [ ] actual AWS evidence を未実施なら残存 gate として記録する。

## 検証計画

- resolver/worker route/store/infra IAM 対象 test
- affected lint/typecheck/test/build
- root `npm run ci`、docs check、release source audit、pre-commit、diff check
- GitHub Actions implementation/final-head CI

## ドキュメント保守計画

- FR-086、audit evidence DLD/OPS、infra inventory の実装境界を確認する。
- README/API への影響がなければ作業レポートに理由を記録する。

## リスク・rollback 境界

- list/scan や tenant 不明 lookup を導入しない。
- transfer の write path や所有権移管 semantics は変更せず、audit read resolver に限定する。
- rollback は resolver/registration/IAM/tests/docs を同じ単位で戻す。
- merge、deploy、release、actual AWS は行わない。

## Done 条件

- deliverables: exact read-only resolver、worker registration、least-privilege IAM、tests/docs、task/report、Draft PR evidence が同じ stacked branch に揃う。
- validations: selected/full/final-head CI が成功し、blocking self-review 指摘がない。
- lifecycle: Issue #358 進捗、clean/upstream 一致まで確認する。
- honesty: actual AWS を実施済みとしない。
