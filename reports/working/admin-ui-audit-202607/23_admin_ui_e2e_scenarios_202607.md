# 管理画面 E2E・非 UI 検証シナリオ（2026-07）

## 目的

画面操作は要件そのものではなく、[22_admin_ui_acceptance_criteria_202607.md](22_admin_ui_acceptance_criteria_202607.md) を利用者視点で検証する具体例として扱う。認可、tenant 分離、idempotency、競合、監査の原子性は browser E2E だけでは証明しないため、各 scenario に必要な非 UI 検証を併記する。

## E2E-AUI-001: 実利用後に 0 ではない根拠付き費用へ到達する

- Actor: `SYSTEM_ADMIN`
- Preconditions: test tenant、versioned test pricing、usage event 未作成の chat user がある
- Steps: chat を一回実行する → provider response と event 保存を待つ → 管理画面の当該期間/user/feature を開く → breakdown を開く
- Expected: quantity、unit、price version、subtotal、measurement source、as-of が同じ run へ追跡できる
- Negative: 同じ completion を再送しても quantity/subtotal は増えない
- Non-UI evidence: provider adapter integration、idempotency store test、period aggregation test
- Trace: `TASK-AUI-001`–`003`; `AC-AUI-001`–`003`, `008`, `013`–`018`, `025`–`028`

## E2E-AUI-002: 欠測・遅延・利用なしを 0 と区別する

- Actor: `SYSTEM_ADMIN`
- Preconditions: complete-zero、provider quantity missing、watermark delayed、query failure の4期間を用意する
- Steps: 各期間を順に選択する
- Expected: 「利用なし」「計測欠測」「集計遅延」「取得失敗」が別状態で表示され、後二者は確定 `$0` にならない
- Recovery: delayed event 到着後に scoped retry すると quantity/cost が一度だけ反映される
- Non-UI evidence: completeness state machine、watermark boundary、error envelope test
- Trace: `AC-AUI-004`–`007`, `020`, `031`, `033`–`035`, `106`–`114`

## E2E-AUI-003: 利用量・料金を絞り込み比較して同じ範囲を export する

- Actor: cost read/export permission を持つ管理者
- Preconditions: 2期間、複数 user/group/model/feature、page size 超過の fixture がある
- Steps: period と複数 filter を指定する → sort/page/comparison を操作する → export する
- Expected:画面、API query、export の期間/filter/sort が一致し、各 page の合計と全体 total の意味が明示される
- Permission variant: export permission のない actor は金額を読めても export できない
- Non-UI evidence: authorization test、export payload/query equivalence test、cursor completeness test
- Trace: `AC-AUI-025`–`040`, `102`–`104`

## E2E-AUI-004: ロールの用途・危険度・差分を理解する

- Actor: `ACCESS_ADMIN`
- Preconditions: system/custom、low/high risk、割当あり/なしの canonical roles がある
- Steps: role を検索する → detail を開く → 2 role を比較する
- Expected:表示名、説明、category、risk、permission group、割当人数、system/custom、permission 差分が raw ID の知識なしで確認できる
- Negative: identity group と application role が同じ control/column に混在しない
- Non-UI evidence: catalog/provisioning drift check、assigned count authorization test
- Trace: `AC-AUI-041`–`052`

## E2E-AUI-005: 既存の複数ロールを壊さず一つだけ付与・解除する

- Actor: `ACCESS_ADMIN`
- Preconditions: target に role A/B があり、actor は target 以外で必要 permission を持つ
- Steps: target detail で role C を選ぶ → before/after/delta と reason を確認して保存 → role B だけを解除する
- Expected: 一回目は A/B/C、二回目は A/C になり、各変更の reason と delta を audit で確認できる
- Non-UI evidence: grant/revoke contract、Cognito group reconciliation、idempotency test
- Trace: `AC-AUI-053`–`056`, `066`–`068`

## E2E-AUI-006: 危険なロール変更と競合を安全に拒否する

- Actor: `ACCESS_ADMIN` と `SYSTEM_ADMIN`
- Preconditions: self target、別tenant target、inactive target、最後の管理者、同時編集 fixture がある
- Steps: 各対象へ禁止変更を試す → 2 browser から同じ user を編集する
- Expected:禁止変更は理由付きで拒否され、旧 version の後着更新は conflict になり、既存 role set は変わらない
- Failure variant: identity provider failure 時に ledger だけ成功表示にならない
- Non-UI evidence: route-level permission、tenant/last-admin/version guard、compensation/reconciliation test
- Trace: `AC-AUI-057`–`065`, `067`

## E2E-AUI-007: 停止・復元が実際の sign-in と API access に効く

- Actor: `USER_ADMIN`、対象 user
- Preconditions: active user が sign-in 済みで既存 session/token を持つ
- Steps: reason を入力して suspend → 対象 user が sign-in と保護 API を試す → restore →再認証する
- Expected: suspend 後は承認済み失効上限内に access が拒否され、restore 後だけ新 session で利用できる
- Negative:管理画面再読込で suspended/deleted が active に戻らない
- Non-UI evidence: live/sandbox Cognito disable/enable/revoke、request-time state check、audit test
- Trace: `AC-AUI-071`–`074`, `081`

## E2E-AUI-008: account lifecycle の途中失敗を検知・回復する

- Actor: `USER_ADMIN`, Ops
- Preconditions: identity create/disable 成功後の ledger failure、identity failure の fault injection が可能
- Steps: create/suspend を実行する →失敗状態を確認する → reconciliation または idempotent retry を実行する
- Expected:架空の active user や成功表示を残さず、修復済みまたは要手動対応を対象ごとに確認できる
- Non-UI evidence: state machine/compensation/fault-injection test
- Trace: `AC-AUI-069`, `070`, `075`–`080`

## E2E-AUI-009: 多数ユーザーから対象と実効権限を特定する

- Actor: `USER_ADMIN` / `ACCESS_ADMIN`
- Preconditions: page size 超過、複数 status/role/resource group、directory stale の fixture がある
- Steps:検索と filter → cursor page → user detail → roles/groups/effective permissions/visible folders/audit drill-down を確認する
- Expected:検索条件を保って対象へ到達し、source/as-of と application role/resource group の違いを判別できる
- Permission variant: scope 外 folder/user 属性は表示・返却されない
- Non-UI evidence: search index/query、cursor stability、field-level authorization test
- Trace: `AC-AUI-082`–`093`

## E2E-AUI-010: 成功・拒否・競合・失敗を共通監査で調査する

- Actor: audit read/export permission を持つ reviewer
- Preconditions: user/role/account/alias の各 result event と100件超の fixture がある
- Steps: period/actor/target/action/result で検索 → detail → cursor → export
- Expected: before/after/reason/result/requestId/policyVersion を追跡でき、export は同じ query scope になる
- Security variant:別 tenant、secret、raw prompt、権限外 resource は表示/export されない
- Non-UI evidence: mutation/audit atomicity、redaction、retention、tenant isolation test
- Trace: `AC-AUI-094`–`105`

## E2E-AUI-011: 初期失敗から panel 単位で回復し URL を復元する

- Actor: section permission を持つ管理者
- Preconditions: users 成功、cost 失敗、roles loading の独立 query state がある
- Steps:深い cost URL を開く → error を確認 → cost だけ retry →別 section へ移動 → back/forward/reload
- Expected:成功済み panel data を失わず cost だけ回復し、section/filter/history が復元される
- Negative:失敗 KPI は 0、invalid response は「未提供」と表示されない
- Non-UI evidence: runtime schema decode、query-state reducer、route authorization test
- Trace: `AC-AUI-106`–`125`

## E2E-AUI-012: overview の異常から対応対象へ drill-down する

- Actor: action target permission を持つ管理者
- Preconditions: completeness error、cost anomaly、未処理 alias、quality action がある
- Steps: overview を開く → card の根拠/threshold/as-of を確認 → card を選ぶ
- Expected:対応 section が必要 filter 付きで開き、対象を調査または処理できる
- Permission variant: scope 外 action の存在・件数を漏らさない
- Non-UI evidence: overview projection/permission test
- Trace: `AC-AUI-120`–`125`

## E2E-AUI-013: alias の差分と理由を保って state transition する

- Actor: `RAG_GROUP_MANAGER`
- Preconditions: draft/review/published/disabled と concurrent version の fixture がある
- Steps:差分 preview → review/publish/reject/draft transition → reason 入力 → concurrent update を試す
- Expected: server 確定 state/version/time だけを表示し、disabled/old version は拒否され、全 result を audit で追跡できる
- Non-UI evidence: transition table、version guard、audit redaction test
- Trace: `AC-AUI-126`–`134`

## E2E-AUI-014: 320 px・400% zoom・touch で主要管理 task を完了する

- Actor: mobile/low-vision user
- Preconditions:代表的な long role、error、empty、多数列 data がある
- Steps: 320 px で user search/detail/role change/cost filter を行う → desktop 400% zoom で繰り返す
- Expected:二方向 scroll、重なり、切断、hover-only action なしに完了し、主要 target が target-size policy を満たす
- Evidence: viewport screenshot、browser/zoom、target measurement を記録する
- Trace: `AC-AUI-135`, `136`, `142`, `146`

## E2E-AUI-015: keyboard と screen reader で危険操作を識別する

- Actor: keyboard/screen reader user
- Preconditions:複数 user/alias row、dialog、loading/error/success 状態がある
- Steps: keyboard だけで section/filter/table/action/dialog を操作 → screen reader で row actions と状態を確認
- Expected:focus が予測可能で、操作名に対象が含まれ、table 関係と live status/alert が重複なく伝わる
- Evidence:承認 browser/AT matrix と自動 a11y scan を記録する
- Trace: `AC-AUI-137`–`141`, `143`–`146`

## E2E-AUI-016: usage/cost 候補実装を欠落なく移行する

- Actor: maintainer、Ops、FinOps
- Preconditions: PR #339 相当 candidate、1,000件超・複数tenant・複数price version の migration fixture がある
- Steps: migration を二回実行 → tenant+period query → dual-read comparison → rollout gate を評価
- Expected:二重計上・tenant 混在・Scan切り捨てがなく、許容差超過時は cutover しない
- Non-UI evidence: migration/integration/load/security tests
- Trace: `AC-AUI-147`–`153`

## E2E-AUI-017: live provider/storage/export canary と rollback を行う

- Actor: Ops、FinOps
- Preconditions:承認済み非production AWS account/test tenant、live Bedrock/DynamoDB/S3、kill switch がある
- Steps: canary chat → event/summary/cost → signed export → redaction確認 →故障注入と rollback → billing reconciliation
- Expected: end-to-end trace、security、rollback、差異記録、runbook 証跡が揃うまで legacy path を停止しない
- Trace: `AC-AUI-154`–`158`

## 現監査で未実施のシナリオ

本監査は仕様作成であり、上記 E2E を実行したものではない。特に `E2E-AUI-007`, `014`, `015`, `017` は実 Cognito、実 browser/AT、実 AWS を必要とするため、後続実装の release gate である。
