# 認可・管理・監査詳細設計

- ファイル: `docs/3_設計_DES/11_詳細設計_DLD/DES_DLD_008.md`
- 種別: `DES_DLD`
- 作成日: 2026-05-07
- 状態: Draft

## 何を書く場所か

API 認可、管理ワークスペース、管理台帳、管理操作監査の責務と境界を定義する。Cognito self sign-up の詳細は `DES_DLD_004` を正とする。

## 対象

- Authorization Layer
- Web Admin Workspace
- Admin Ledger
- Admin Audit Log
- permission model
- 管理対象ユーザー、role group、利用状況、概算コストの管理 API contract

## 関連要求

- `FR-024`
- `FR-027`
- `FR-095`
- `FR-096`
- `FR-097`
- `FR-098`
- `NFR-010`
- `NFR-011`
- `SQ-016`

## 入出力

| 処理 | 入力 | 出力 |
|---|---|---|
| `resolve_permissions` | Cognito groups、user attributes | permission set、role summary |
| `authorize_route` | route id、method、permission set、resource context | allow/deny、reason |
| `render_admin_workspace` | `GET /me` permissions、admin resources | permission-scoped admin view |
| `list_admin_users` | admin user、filters、pagination | managed user list |
| `update_admin_role_group` | admin user、target user、group update | group assignment result、audit event |
| `record_admin_audit` | actor、operation、target、result | admin audit log item |
| `list_admin_audit` | tenant 内 query、action、cursor、limit | total/truncation/source/as-of 付き audit page |
| `export_admin_audit` | tenant 内 query、非空 reason | redacted 全 page artifact、signed download URL、export audit event |
| `govern_alias` | tenant 内 alias、expected version、reason、transition | server-authoritative alias state、version、audit result |

## 責務分担

| 要素 | 責務 |
|---|---|
| Authorization Layer | API route ごとに permission と resource scope を判定する。 |
| Web Admin Workspace | permission に応じて文書、alias、問い合わせ、debug、benchmark、ユーザー、監査、利用量、コスト view を出し分ける。 |
| Admin Ledger | 管理対象ユーザー、role group、管理操作履歴、利用状況、概算コストの contract を提供する。 |
| Admin Audit Log | 管理操作の actor、target、operation、result、timestamp、reason を保存する。 |
| Cognito adapter | Cognito Admin API 連携を隠蔽し、Admin Ledger の contract へ合わせる。 |

## 処理手順

### API 認可

1. API は認証済み user context から Cognito group と user attributes を取り出す。
2. Authorization Layer は group を permission set へ変換する。
3. route id、method、resource context に必要な permission を解決する。
4. permission が不足する場合は handler 本体を実行せず拒否する。
5. resource owner、tenant、ACL group、担当者制約がある route は route-level permission に加えて resource scope を確認する。
6. 判定結果は必要に応じて debug metadata または audit log に残す。ただし通常利用者 response へ内部 policy 詳細を返さない。

### 管理ワークスペース

1. Web UI は `GET /me` から permission set を取得する。
2. Web Admin Workspace は permission に応じて view と操作ボタンを表示する。
3. 操作 API は Web 表示に関係なく Authorization Layer で再検証する。
4. 文書管理、alias 管理、問い合わせ対応、debug、benchmark、ユーザー管理、監査、コストは view 単位で権限を分離する。
5. section、filter、sort、selection は allowlist 済み URL query として復元し、機微値や内部本文は URL に保存しない。
6. 各 panel は response の source/as-of、取得状態、対象付き retry を表示し、未取得・権限不足・失敗を zero に変換しない。
7. user/監査/alias list response の cursor/total/truncation を使い、client 固定件数で切り捨てない。
8. user mutation の pending/error は target/action key で分離し、別 user の操作を global loading で無効化しない。

### 管理台帳

1. 管理者は Admin Ledger から管理対象ユーザー一覧を取得する。
2. role group 付与、停止、再開、削除などの操作 request を送る。
3. API は permission、target user、操作理由、状態遷移を検証する。
4. server capability は self、inactive/cross-tenant target、最後の recovery principal を事前説明するが、mutation 時にも authoritative identity、tenant、permission、state transition を再検証する。
5. Cognito adapter がある場合は authoritative directory/identity を正とし、tenant 管理台帳へ projection する。suspended/deleted の deny-first state は actor load や stale directory snapshot だけで active へ戻さない。
6. tenant 管理台帳は object version の条件付き write と commit 後再読込で sibling mutation の上書きを拒否する。
7. role/account mutation は session revoke、effective permission、propagation/reconciliation、audit reference を operation evidence として返す。

### Alias governance

1. actor の authoritative tenant と route permission を確認し、client が送る alias scope の tenant 値は採用しない。
2. list/audit は tenant 内で filter/sort した安定順序から opaque cursor を生成し、`total`、`nextCursor`、`truncated`、`source`、`asOf` を返す。
3. update/review/draft transition/disable は `expectedVersion` と非空の `reason` を必須にし、不正 state transition と古い version を拒否する。
4. success/denied/conflict/failed は actor、reason、before/after status、alias version とともに tenant-scoped audit event として保存する。
5. publish は同一 tenant の approved alias だけを versioned artifact にまとめ、tenant partitioned latest pointer を更新する。通常検索 response には alias 本文を返さない。
6. artifact、ledger、latest pointer の multi-object atomicity と補償は未実装であり、公開失敗時の完全な rollback/reconciliation は後続 P0 とする。

### 監査

1. アクセス管理者または監査担当者は audit log list を取得する。
2. API は audit log 閲覧 permission を検証する。
3. read model は actor tenant の common security audit outbox と legacy 成功 event を正規化し、actor、operation、target、result、reason、policy version、source、timestamp を返す。
4. `pending`、`success`、`denied`、`conflict`、`failed` を別結果として保持し、pending/unknown を成功へ変換しない。
5. export は `access:audit:export`、非空 reason、閲覧と同一 query、全 page、tenant partition、redaction metadata を強制し、export の結果も監査する。
6. raw token、password、confirmation code、内部 secret、signed URL は audit log に保存しない。

## 権限境界

- `SYSTEM_ADMIN` などの上位権限付与は self sign-up path では実行できない。
- API 側の Authorization Layer を正とし、Web UI の表示制御は補助とする。
- debug trace、benchmark artifact、alias 本文、ACL metadata、raw prompt、chunk text は個別 permission で保護する。
- 管理者自身の権限剥奪や最後の管理者削除など、運用不能につながる操作は状態遷移規則で拒否または追加承認を要求する。

## エラー処理

| 事象 | 方針 |
|---|---|
| group から permission を解決できない | 最小権限として扱い、必要 permission がない route は拒否する。 |
| route permission 未定義 | fail closed とし、明示 policy 追加まで拒否する。 |
| Web 表示権限はあるが API 権限がない | API の 403 を正とし、Web UI は権限不足として表示する。 |
| Cognito adapter 失敗 | 管理台帳を成功扱いにせず、audit log に failure を残す。 |
| audit log 保存失敗 | 管理操作の扱いを operation ごとに定義し、監査必須操作は失敗として返す。 |

## テスト観点

| 観点 | 期待 |
|---|---|
| permission 解決 | Cognito group から想定 permission set が得られる。 |
| fail closed | 未定義 route permission が許可されない。 |
| resource scope | 他 user、他 tenant、担当外 ticket の操作が拒否される。 |
| 管理 view | `GET /me` permission に応じて view が出し分けられる。 |
| API 再検証 | Web 表示を迂回した request でも API が permission を確認する。 |
| 監査 | 管理操作の actor、target、operation、result が保存される。 |
| 機微情報非保存 | password、token、confirmation code、secret が audit log に入らない。 |
| alias tenant 境界 | 他 tenant の alias/list/audit/mutation/published artifact を取得・変更できない。 |
| alias concurrency | 古い record/ledger version の mutation/publish は conflict となり、後着更新を上書きしない。 |
| list 規模 | 同一 sort 値を含む複数 page で欠落・重複せず、invalid cursor を拒否する。 |
| 管理台帳競合 | 同じ version からの sibling mutation は一方だけが commit され、後着 write は fail closed になる。 |
| projection invariant | stale directory snapshot や actor load で suspended/deleted target を active に復活させず、他 tenant identity を混入させない。 |
| audit export | read と export permission を分離し、同じ query の全 page、tenant scope、redaction、success/failure audit を検証する。 |
| UI 状態 | URL 復元、part retry、320〜1280px reflow、axe を自動検証し、400% zoom・screen reader・real device は手動 evidence と区別する。 |
