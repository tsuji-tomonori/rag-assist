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
- `NFR-010`
- `NFR-011`

## 入出力

| 処理 | 入力 | 出力 |
|---|---|---|
| `resolve_permissions` | Cognito groups、user attributes | permission set、role summary |
| `authorize_route` | route id、method、permission set、resource context | allow/deny、reason |
| `render_admin_workspace` | `GET /me` permissions、admin resources | permission-scoped admin view |
| `list_admin_users` | admin user、filters、pagination | managed user list |
| `update_admin_role_group` | admin user、target user、group update | group assignment result、audit event |
| `record_admin_audit` | actor、operation、target、result | admin audit log item |

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

### 管理台帳

1. 管理者は Admin Ledger から管理対象ユーザー一覧を取得する。
2. role group 付与、停止、再開、削除などの操作 request を送る。
3. API は permission、target user、操作理由、状態遷移を検証する。
4. Cognito adapter または暫定 ledger store が操作を反映する。
5. Admin Audit Log は actor、target、operation、result、reason を保存する。

### 監査

1. アクセス管理者または監査担当者は audit log list を取得する。
2. API は audit log 閲覧 permission を検証する。
3. response は actor、operation、target summary、result、timestamp を返す。
4. raw token、password、confirmation code、内部 secret は audit log に保存しない。

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
