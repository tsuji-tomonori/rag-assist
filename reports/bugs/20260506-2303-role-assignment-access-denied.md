# 障害レポート

**保存先:** `reports/bugs/20260506-2303-role-assignment-access-denied.md`
**概要:** 管理画面または作成 workflow で回答担当・性能テスト担当相当の role を付与しても、対象ユーザーが担当者対応や性能テスト機能へアクセスできない。主因は、管理 API の role 変更が管理台帳だけを更新し、実際の認可に使う Cognito group / JWT へ反映していないことである。
**重大度:** `S1_high`
**状態:** `resolved`
**影響:** 回答担当者が問い合わせ一覧・回答登録へ進めない。性能テスト担当者が性能テスト画面や run 起動 API へ進めない。管理画面上の role 表示と実際の API 認可が乖離し、運用者が権限付与済みと誤認する。
**原因仮説:** `MemoRagService.assignUserRoles()` が `admin-ledger` の `ManagedUser.groups` だけを更新し、`CognitoUserDirectory` は `listUsers()` のみで Cognito group の追加・削除を持たないため、ログイン token の `cognito:groups` が変わらない。加えて `BENCHMARK_RUNNER` は `/benchmark/query`・`/benchmark/search` を呼ぶ service user 向け role であり、Web の性能テスト画面が要求する `benchmark:read` / `benchmark:run` を持たない。
**現在の対応:** Cognito group 同期メソッド、role 定義、回帰テスト、運用文書を修正済み。
**次のアクション:**
- 管理 API の role 付与時に Cognito group を追加・削除する。
- 人間の性能テスト担当 role と runner service role を分離し、作成 workflow とドキュメントの表記を明確化する。
- 回答担当・性能テスト担当の API / Web アクセス回帰テストを追加する。

```json failure_report
{
  "schema_version": "1.0.0",
  "report_id": "FR-20260506-230300-ROLE-ACCESS",
  "created_at": "2026-05-06T23:03:00+09:00",
  "incident_type": "safety_or_policy_block",
  "failure_mode": "permission_denied",
  "severity": "S1_high",
  "status": "resolved",
  "summary": "回答担当・性能テスト担当相当の role 付与後も対象機能へアクセスできない。",
  "user_request": "権限において、回答担当や性能テスト担当にしても、その機能へアクセスできませんでした。原因は? 障害レポートを作成したうえで、修正して。",
  "expected": [
    "ANSWER_EDITOR を付与された利用者は担当者対応の一覧・回答操作へアクセスできる。",
    "人間向けの性能テスト担当 role を付与された利用者は性能テスト画面と run 起動 API へアクセスできる。",
    "管理画面または作成 workflow の role 付与結果が実際の API 認可に反映される。"
  ],
  "actual": [
    "assignUserRoles は admin ledger の groups だけを更新し、Cognito group を更新していなかった。",
    "API 認可は JWT の cognito:groups から計算した permission を使用するため、ledger だけの変更では権限が変わらない。",
    "BENCHMARK_RUNNER は benchmark:query と benchmark:seed_corpus だけを持ち、Web の性能テスト画面に必要な benchmark:read / benchmark:run を持っていなかった。"
  ],
  "impact": {
    "users": "回答担当者、性能テスト担当者、アクセス管理者",
    "systems": ["管理画面", "Cognito group", "API RBAC", "性能テスト UI"],
    "security": "権限過多ではなく権限不足の障害。ただし role 表示と実認可の乖離により運用ミスを誘発する。"
  },
  "evidence": [
    {
      "path": "memorag-bedrock-mvp/apps/api/src/rag/memorag-service.ts",
      "detail": "assignUserRoles は user.groups を更新して saveAdminLedger するだけで Cognito group 更新を呼ばない。"
    },
    {
      "path": "memorag-bedrock-mvp/apps/api/src/adapters/user-directory.ts",
      "detail": "UserDirectory は listUsers のみを提供し、AdminAddUserToGroup / AdminRemoveUserFromGroup 相当の更新操作を持たない。"
    },
    {
      "path": "memorag-bedrock-mvp/apps/api/src/authorization.ts",
      "detail": "hasPermission は AppUser.cognitoGroups から permission を計算する。"
    },
    {
      "path": "memorag-bedrock-mvp/apps/web/src/app/hooks/usePermissions.ts",
      "detail": "性能テスト画面表示は benchmark:read、run 起動は benchmark:run に依存する。"
    },
    {
      "path": "memorag-bedrock-mvp/apps/api/src/authorization.ts",
      "detail": "BENCHMARK_RUNNER は benchmark:query と benchmark:seed_corpus のみで、benchmark:read / benchmark:run を持たない。"
    }
  ],
  "suspected_root_cause": {
    "confidence": "high",
    "items": [
      "管理台帳と Cognito group の同期責務が未実装だった。",
      "BENCHMARK_RUNNER という role 名が、人間の性能テスト担当と runner service user の両方に見えてしまう設計・文言だった。"
    ]
  },
  "actions_taken": [
    "権限定義、route policy、Web permission hook、作成 workflow、README、既存障害レポートを確認した。",
    "修正方針を Cognito group 同期と人間向け性能テスト role の分離に決定した。"
  ],
  "corrective_actions": [
    {
      "owner": "codex",
      "action": "CognitoUserDirectory に group 更新操作を追加し、assignUserRoles から呼び出す。",
      "status": "done",
      "due": "2026-05-06"
    },
    {
      "owner": "codex",
      "action": "BENCHMARK_OPERATOR role を追加し、人間向け性能テスト担当に benchmark:read / benchmark:run を付与する。",
      "status": "done",
      "due": "2026-05-06"
    },
    {
      "owner": "codex",
      "action": "回答担当・性能テスト担当の API / Web 回帰テストを追加する。",
      "status": "done",
      "due": "2026-05-06"
    }
  ],
  "open_questions": [
    "既存環境では CDK deploy 後に BENCHMARK_OPERATOR Cognito group が作成されるため、既存ユーザーへの role 付け替えが必要。"
  ],
  "confidence": "high",
  "tags": ["rbac", "cognito", "answer-editor", "benchmark", "admin-ui"],
  "environment": {
    "repository": "rag-assist",
    "date": "2026-05-06",
    "timezone": "Asia/Tokyo"
  },
  "affected_artifacts": [
    "memorag-bedrock-mvp/apps/api/src/rag/memorag-service.ts",
    "memorag-bedrock-mvp/apps/api/src/adapters/user-directory.ts",
    "memorag-bedrock-mvp/apps/api/src/authorization.ts",
    "memorag-bedrock-mvp/apps/web/src/app/hooks/usePermissions.ts",
    ".github/workflows/memorag-create-cognito-user.yml"
  ],
  "validation": {
    "planned": [
      "npm --prefix memorag-bedrock-mvp run test -w @memorag-mvp/api",
      "npm --prefix memorag-bedrock-mvp run test -w @memorag-mvp/web",
      "npm --prefix memorag-bedrock-mvp run test -w @memorag-mvp/infra",
      "npm --prefix memorag-bedrock-mvp run typecheck --workspaces --if-present",
      "git diff --check"
    ],
    "completed": [
      "npm --prefix memorag-bedrock-mvp run test -w @memorag-mvp/api: pass",
      "npm --prefix memorag-bedrock-mvp run test -w @memorag-mvp/web: pass",
      "UPDATE_SNAPSHOTS=1 npm --prefix memorag-bedrock-mvp run test -w @memorag-mvp/infra: pass",
      "npm --prefix memorag-bedrock-mvp run typecheck --workspaces --if-present: pass",
      "git diff --check: pass"
    ],
    "not_run": [
      "task docs:check:changed: task が存在しないため未実施"
    ]
  },
  "prevention": [
    "role 追加・変更時は API permission、Cognito group、Web 表示条件、作成 workflow、日本語 role 名を同時に確認する。",
    "管理画面の role 変更は JWT の権限源泉に反映されることを contract test で確認する。"
  ],
  "redactions": []
}
```
