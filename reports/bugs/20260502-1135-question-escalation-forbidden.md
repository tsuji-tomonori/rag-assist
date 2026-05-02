# 障害レポート

**保存先:** `reports/bugs/20260502-1135-question-escalation-forbidden.md`
**概要:** 通常のチャットユーザーが「担当者へ送信」を押した後、質問作成自体は成功し得るにもかかわらず、後続の `GET /questions` が `Forbidden: missing user:read` で失敗し、画面上は問い合わせ操作が失敗したように見える状態だった。加えて、同じ初期表示処理で `GET /debug-runs` も `Forbidden: missing chat:admin:read_all` を発生させていた。
**重大度:** S2_medium
**状態:** resolved
**影響:** 通常ユーザーが回答不能な質問を担当者へエスカレーションした際、403 が表示される、またはブラウザコンソールに不要な 403 が残る。担当者対応ビューとデバッグ履歴は権限が必要な機能だが、通常ユーザーにも読み込みが走っていた。
**原因仮説:** API の質問一覧権限が担当者ロールではなく `user:read` に紐づいており、Web がロールを見ずに質問一覧とデバッグ履歴を読み込んでいたため。
**現在の対応:** API の質問一覧・回答・解決を `answer:edit` に統一し、Web は Cognito group からクライアント側の機能可否を判断して、権限のある機能だけ事前取得するように修正した。通常ユーザーのエスカレーション後はローカルに作成済みチケットを反映し、権限不要な操作として完了させる。
**次のアクション:** 本番反映時に Cognito group の `ANSWER_EDITOR` 割当と、通常ユーザーで `GET /questions` / `GET /debug-runs` が発火しないことを確認する。

## なぜなぜ分析

1. なぜ `Forbidden: missing user:read` が出たか
   - `POST /questions` 後に Web が `refreshQuestions()` を呼び、`GET /questions` を実行していたため。
2. なぜ通常ユーザーが `GET /questions` を呼んでいたか
   - App 初期化と問い合わせ送信後の refresh が、ユーザーの Cognito group を見ずに一律実行されていたため。
3. なぜ `GET /questions` が `user:read` を要求していたか
   - 担当者向け質問一覧がユーザー管理権限に誤って紐づいており、担当者の回答編集権限と分離されていなかったため。
4. なぜ `debug-runs` でも 403 が出たか
   - デバッグ履歴は `chat:admin:read_all` が必要だが、通常ユーザーでも初期表示時に読み込みが走っていたため。
5. なぜ事前に検出できなかったか
   - 既存テストが local 認証の `SYSTEM_ADMIN` 前提に偏っており、`CHAT_USER` の権限でエスカレーションするケースを検証していなかったため。

## 修正内容

- `apps/api/src/app.ts`
  - `GET /questions`、`POST /questions/{questionId}/answer`、`POST /questions/{questionId}/resolve` を `answer:edit` 必須にした。
- `apps/web/src/authClient.ts`
  - Cognito ID token の `cognito:groups` を `AuthSession` に保持するようにした。
  - 既存保存セッションでも ID token から group を補完できるようにした。
- `apps/web/src/App.tsx`
  - `ANSWER_EDITOR` / `SYSTEM_ADMIN` のみ担当者対応を表示し、`GET /questions` を実行するようにした。
  - `SYSTEM_ADMIN` のみ `GET /debug-runs` を事前取得するようにした。
  - 通常ユーザーの問い合わせ送信後は `GET /questions` に依存せず、作成済みチケットを画面に反映するようにした。
- テスト
  - `CHAT_USER` が問い合わせ送信時に `/questions` GET と `/debug-runs` GET を発火しない UI テストを追加した。
  - Cognito group のセッション保存テストと `ANSWER_EDITOR` の権限テストを追加した。

## 検証結果

- `npm --prefix memorag-bedrock-mvp/apps/web run typecheck`: 成功
- `npm --prefix memorag-bedrock-mvp/apps/api run typecheck`: 成功
- `npm --prefix memorag-bedrock-mvp/apps/web run test -- App.test.tsx authClient.test.ts`: 成功、2 files / 27 tests
- `npm --prefix memorag-bedrock-mvp/apps/api test -- authorization.test.ts`: 成功、API test runner の glob により 35 tests 実行
- `npm --prefix memorag-bedrock-mvp/apps/web run build`: 成功
- `npm --prefix memorag-bedrock-mvp/apps/api run build`: 成功

```json failure_report
{
  "schema_version": "1.0.0",
  "report_id": "FR-20260502-113523-QESC",
  "created_at": "2026-05-02T02:35:23Z",
  "incident_type": "runtime_error",
  "failure_mode": "permission_denied",
  "severity": "S2_medium",
  "status": "resolved",
  "summary": {
    "title": "担当者問い合わせ後の不要な403",
    "description": "通常ユーザーの問い合わせ送信後と初期表示で、権限が必要な質問一覧とデバッグ履歴を読み込み、403を発生させていた。",
    "detected_by": "user",
    "detected_at": "2026-05-02T02:35:23Z"
  },
  "user_request": {
    "original_request_excerpt": "担当者へ問い合わせるボタンを押したところForbidden: missing user:readとなりました。障害レポートを作成したうえでなぜなぜ分析を行い修正/テスト実装まで",
    "interpreted_goal": "403の原因を分析し、障害レポート、修正、テスト、commit、PR作成まで行う。",
    "explicit_constraints": [
      "worktreeを作成する",
      "障害レポートを作成する",
      "なぜなぜ分析を行う",
      "修正とテスト実装を行う",
      "git commitとmain向けPRを作成する"
    ],
    "implicit_constraints": [
      "通常ユーザーの問い合わせ送信は管理権限なしで完了する",
      "権限がない管理系リソースを通常ユーザーで事前取得しない"
    ]
  },
  "expected": {
    "success_criteria": [
      "CHAT_USERで担当者への問い合わせ送信後にGET /questionsを実行しない",
      "CHAT_USERで初期表示時にGET /debug-runsを実行しない",
      "担当者向け質問操作はANSWER_EDITORの権限で実行できる",
      "SYSTEM_ADMINの既存ローカル開発フローは維持する"
    ],
    "expected_output": "問い合わせ送信後に担当者へ送信済み表示となり、不要な403が発生しない。",
    "expected_format": "コード修正、テスト、Markdown障害レポート"
  },
  "actual": {
    "observed_output": "Forbidden: missing user:read / Forbidden: missing chat:admin:read_all",
    "observed_behavior": "Webが通常ユーザーでもGET /questionsとGET /debug-runsを実行していた。",
    "deviation_from_expected": [
      "問い合わせ作成後の画面更新が権限付き一覧取得に依存していた",
      "デバッグ履歴の取得が管理者権限を考慮せず初期表示で走っていた",
      "担当者向け質問一覧がuser:readに紐づいていた"
    ]
  },
  "impact": {
    "user_impact": "通常ユーザーが問い合わせ送信に失敗したように見える。ブラウザコンソールにも403が記録される。",
    "artifact_impact": "Webアプリのエスカレーション導線とAPI認可設定に影響。",
    "scope": "workflow",
    "blocked": false
  },
  "affected_artifacts": [
    {
      "type": "code",
      "name": "App",
      "path_or_identifier": "memorag-bedrock-mvp/apps/web/src/App.tsx",
      "status": "fixed"
    },
    {
      "type": "code",
      "name": "authClient",
      "path_or_identifier": "memorag-bedrock-mvp/apps/web/src/authClient.ts",
      "status": "fixed"
    },
    {
      "type": "code",
      "name": "API routes",
      "path_or_identifier": "memorag-bedrock-mvp/apps/api/src/app.ts",
      "status": "fixed"
    },
    {
      "type": "test",
      "name": "App and authorization tests",
      "path_or_identifier": "memorag-bedrock-mvp/apps/web/src/App.test.tsx; memorag-bedrock-mvp/apps/web/src/authClient.test.ts; memorag-bedrock-mvp/apps/api/src/authorization.test.ts",
      "status": "fixed"
    }
  ],
  "environment": {
    "tools_used": [
      "rg",
      "npm",
      "tsc",
      "vitest",
      "tsx --test"
    ],
    "runtime": "Node.js/npm workspace",
    "platform": "local worktree",
    "dependencies": [
      "React",
      "Hono",
      "Cognito ID token groups"
    ],
    "external_services": [
      "AWS API Gateway",
      "Cognito"
    ]
  },
  "evidence": [
    {
      "kind": "log",
      "source": "user-provided browser console",
      "content": "Failed to load questions Error: Forbidden: missing user:read",
      "timestamp": "2026-05-02T02:35:23Z"
    },
    {
      "kind": "log",
      "source": "user-provided browser console",
      "content": "Failed to load debug runs Error: Forbidden: missing chat:admin:read_all",
      "timestamp": "2026-05-02T02:35:23Z"
    },
    {
      "kind": "code",
      "source": "memorag-bedrock-mvp/apps/api/src/app.ts",
      "content": "GET /questions required user:read before the fix.",
      "timestamp": "2026-05-02T02:35:23Z"
    },
    {
      "kind": "code",
      "source": "memorag-bedrock-mvp/apps/web/src/App.tsx",
      "content": "Initial load called refreshDebugRuns and refreshQuestions for every authenticated session before the fix.",
      "timestamp": "2026-05-02T02:35:23Z"
    }
  ],
  "reproduction": {
    "reproducible": "yes",
    "steps": [
      "CHAT_USER相当の通常ユーザーでログインする",
      "回答不能な質問を送信する",
      "担当者へ送信を押す",
      "POST /questions後にGET /questionsが走り403となる",
      "初期表示でもGET /debug-runsが走り403となる"
    ],
    "minimal_case": "CHAT_USERセッションでAppを描画し、回答不能応答から担当者へ送信する。",
    "repro_result": "修正後のテストではGET /questionsとGET /debug-runsが発火しないことを確認。"
  },
  "validation": {
    "checks_performed": [
      "web typecheck",
      "api typecheck",
      "web App/authClient tests",
      "api tests including authorization",
      "web build",
      "api build"
    ],
    "checks_failed": [],
    "checks_not_performed": [
      "本番Cognito groupを使った実環境疎通",
      "GitHub Actions上のCI"
    ],
    "known_uncertainties": [
      "本番ユーザーのCognito group割当が想定どおりかは未確認"
    ]
  },
  "suspected_root_cause": {
    "category": "authorization_scope_mismatch",
    "description": "担当者向け質問一覧をuser:readに紐づけ、Web側もロールを見ずに一覧取得していたため、通常ユーザーのエスカレーション導線が管理権限に依存した。",
    "confidence": "high",
    "supporting_evidence": [
      "API route used user:read for GET /questions",
      "App initial effect unconditionally called refreshQuestions and refreshDebugRuns",
      "New CHAT_USER UI test reproduces the prohibited calls before the fix design"
    ]
  },
  "contributing_factors": [
    "local認証テストがSYSTEM_ADMIN中心だった",
    "問い合わせ作成後の画面更新が一覧取得に依存していた",
    "管理者向けdebug-runsの取得がdebug modeやroleに連動していなかった"
  ],
  "timeline": [
    {
      "timestamp": "2026-05-02T02:35:23Z",
      "event": "ユーザーから403ログ付きで障害調査と修正を依頼された"
    },
    {
      "timestamp": "2026-05-02T02:37:00Z",
      "event": "APIとWebの権限チェック箇所を特定した"
    },
    {
      "timestamp": "2026-05-02T02:38:00Z",
      "event": "権限別ロード制御とAPI権限修正を実装した"
    },
    {
      "timestamp": "2026-05-02T02:40:00Z",
      "event": "typecheck、テスト、buildを実行して成功を確認した"
    }
  ],
  "actions_taken": [
    "worktree codex/fix-missing-scope-forbidden を作成した",
    "APIの質問管理権限をanswer:editへ変更した",
    "WebでCognito groupを保持して機能ロードを制御した",
    "CHAT_USERのエスカレーション再現テストを追加した",
    "障害レポートを作成した"
  ],
  "workaround": {
    "available": true,
    "description": "修正前の暫定回避としては、通常ユーザーに過大なuser:readやchat:admin:read_allを付与する方法があるが、権限過多となるため推奨しない。",
    "limitations": [
      "最小権限原則に反する",
      "debug-runsやユーザー管理系の閲覧範囲が広がる"
    ]
  },
  "corrective_actions": [
    {
      "action": "GET /questionsと回答更新系APIをanswer:editに統一する",
      "owner": "assistant",
      "due": "2026-05-02",
      "status": "done"
    },
    {
      "action": "CHAT_USERでは担当者一覧とdebug-runsを事前取得しない",
      "owner": "assistant",
      "due": "2026-05-02",
      "status": "done"
    },
    {
      "action": "本番Cognito groupのANSWER_EDITOR割当を確認する",
      "owner": "operator",
      "due": "unknown",
      "status": "not_started"
    }
  ],
  "prevention": {
    "recommended_changes": [
      "UIのロール別機能表示を権限テーブルで管理する",
      "API routeの認可権限をユースケース単位でレビューする"
    ],
    "tests_to_add": [
      "CHAT_USERが問い合わせ送信時に管理系GETを実行しないテスト",
      "ANSWER_EDITORが質問回答権限を持つテスト"
    ],
    "process_changes": [
      "新規API導線では通常ユーザー、担当者、管理者の3ロールで最低1ケースずつ確認する"
    ]
  },
  "open_questions": [
    "本番環境で担当者ユーザーにANSWER_EDITOR groupが付与されているか",
    "debug-runsの履歴参照をSYSTEM_ADMIN以外にも許可する運用要件があるか"
  ],
  "related_reports": [],
  "redactions": [],
  "confidence": "high",
  "tags": [
    "authorization",
    "cognito",
    "questions",
    "debug-runs",
    "frontend"
  ]
}
```
