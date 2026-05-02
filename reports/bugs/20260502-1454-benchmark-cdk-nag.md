## 障害レポート

**保存先:** `reports/bugs/20260502-1454-benchmark-cdk-nag.md`
**概要:** `task cdk:synth:yaml` 相当の CDK synth で cdk-nag `AwsSolutions-CB4`、`AwsSolutions-SF1`、`AwsSolutions-SF2` が検出され、CI が exit code 1 で停止した。
**重大度:** S2_medium
**状態:** resolved
**影響:** benchmark runner の CDK template を artifact 化できず、deploy workflow がブロックされる。
**原因仮説:** 新規追加された benchmark 用 CodeBuild / Step Functions resource に、暗号化 key、全イベントログ、X-Ray tracing の監査・運用設定が不足していた。
**現在の対応:** CodeBuild KMS key と Step Functions ALL logging を追加した。X-Ray tracing は trace 数に応じた追加コストを避けるため無効のまま、`AwsSolutions-SF2` は理由付き suppression とした。
**次のアクション:** PR review 後に main へ merge する。

### なぜなぜ分析

| なぜ | 分析 |
|---|---|
| 1. なぜ CI が失敗したか | cdk-nag が `AwsSolutions-CB4`、`AwsSolutions-SF1`、`AwsSolutions-SF2` を error として検出したため。 |
| 2. なぜ cdk-nag が error を出したか | `BenchmarkProject` に KMS key がなく、`BenchmarkStateMachine` に `ALL` logging と X-Ray tracing がなかったため。 |
| 3. なぜ設定が不足したか | benchmark 実行基盤の追加時、機能実行に必要な S3 / DynamoDB / CodeBuild / Step Functions 接続を優先し、監査・運用品質設定の受け入れ条件がテストに入っていなかったため。 |
| 4. なぜテストで事前検出できなかったか | 既存 infra test は resource の存在と snapshot を確認していたが、CodeBuild encryption key、Step Functions logging/tracing を明示的に assertion していなかったため。 |
| 5. なぜ再発しうるか | cdk-nag の CI synth が最終ゲートになっており、resource 追加時のローカル unit test が cdk-nag 主要ルールを十分に表現していないため。 |

### 再発防止

- CDK 定義で benchmark 用 CodeBuild artifact encryption key を明示する。
- Step Functions の CloudWatch Logs level を `ALL` にする。
- X-Ray tracing は MVP の benchmark 実行頻度とコストを踏まえて無効化し、`AwsSolutions-SF2` は suppression 理由を明記する。
- infra test に encryption / logging と X-Ray tracing 無効の assertion を追加し、snapshot を更新する。
- CDK synth を検証に含め、cdk-nag error が再発しないことを確認する。

### 検証結果

- `task memorag:cdk:test`: 成功
- `task memorag:cdk:synth:yaml`: 成功
- `task memorag:cdk:synth:yaml` では `AwsSolutions-CB4`、`AwsSolutions-SF1`、`AwsSolutions-SF2` の error は再発しなかった。
- `AwsSolutions-SF2` は X-Ray tracing を有効化せず、コスト抑制の理由付き suppression で解消した。
- 既存の `AwsSolutions-COG2` warning は残存しているが、今回提示された failed error ではないため対象外とした。

```json failure_report
{
  "schema_version": "1.0.0",
  "report_id": "FR-20260502-145427-BENCHMARK-CDK-NAG",
  "created_at": "2026-05-02T05:54:27Z",
  "incident_type": "test_failure",
  "failure_mode": "command_failed",
  "severity": "S2_medium",
  "status": "resolved",
  "summary": {
    "title": "Benchmark CDK resource の cdk-nag 指摘で synth が失敗",
    "description": "CodeBuild project の KMS key 未設定、Step Functions の ALL logging 未設定、X-Ray tracing 未設定により cdk-nag が error を検出した。",
    "detected_by": "user",
    "detected_at": "2026-05-02T05:54:27Z"
  },
  "user_request": {
    "original_request_excerpt": "AwsSolutions-CB4 / AwsSolutions-SF1 / AwsSolutions-SF2 のエラーを解消して。なぜなぜ分析を行い障害レポートを作成してから実装、テスト。",
    "interpreted_goal": "benchmark 用 CDK resource を cdk-nag AwsSolutions ルールに適合させ、再発防止のレポートと検証を残す。",
    "explicit_constraints": [
      "worktree を作成する",
      "障害レポートを作成してから実装する",
      "実装後にテストする",
      "git commit し main 向け PR を GitHub Apps で作成する"
    ],
    "implicit_constraints": [
      "実施していない検証を実施済みとして書かない",
      "PR title/body と commit message は日本語ルールに従う"
    ]
  },
  "expected": {
    "success_criteria": [
      "CodeBuild project が AWS KMS key を使う",
      "Step Functions が CloudWatch Logs に ALL events を出力する",
      "Step Functions の X-Ray tracing を有効化するか、明示的な理由で suppression する",
      "CDK test と synth が成功する"
    ],
    "expected_output": "cdk-nag error が解消された CDK template",
    "expected_format": "CDK TypeScript 定義、infra test、障害レポート"
  },
  "actual": {
    "observed_output": "AwsSolutions-CB4、AwsSolutions-SF1、AwsSolutions-SF2 が Found errors として報告された。",
    "observed_behavior": "CDK synth workflow が exit code 1 で停止した。",
    "deviation_from_expected": [
      "BenchmarkProject に KMS key がない",
      "BenchmarkStateMachine の logging level が ALL ではない",
      "BenchmarkStateMachine の tracing が有効ではない"
    ]
  },
  "impact": {
    "user_impact": "deploy workflow の artifact 作成と PR 検証が止まる。",
    "artifact_impact": "CloudFormation template が cdk-nag AwsSolutions の基準を満たさない。",
    "scope": "benchmark infra",
    "blocked": false
  },
  "affected_artifacts": [
    "memorag-bedrock-mvp/infra/lib/memorag-mvp-stack.ts",
    "memorag-bedrock-mvp/infra/test/memorag-mvp-stack.test.ts",
    "memorag-bedrock-mvp/infra/test/__snapshots__/memorag-mvp-stack.snapshot.json"
  ],
  "environment": {
    "tools_used": [
      "cdk-nag",
      "AWS CDK",
      "node:test"
    ],
    "runtime": "Node.js workspace",
    "platform": "local worktree",
    "dependencies": [
      "aws-cdk-lib",
      "cdk-nag"
    ],
    "external_services": [
      "AWS CloudFormation",
      "AWS CodeBuild",
      "AWS Step Functions",
      "AWS CloudWatch Logs",
      "AWS X-Ray",
      "AWS KMS"
    ]
  },
  "evidence": [
    {
      "kind": "user_provided_error",
      "source": "user request",
      "content": "AwsSolutions-CB4: The CodeBuild project does not use an AWS KMS key for encryption. AwsSolutions-SF1: The Step Function does not log ALL events to CloudWatch Logs. AwsSolutions-SF2: The Step Function does not have X-Ray tracing enabled.",
      "timestamp": "2026-05-02T05:54:27Z"
    },
    {
      "kind": "code_inspection",
      "source": "memorag-bedrock-mvp/infra/lib/memorag-mvp-stack.ts",
      "content": "BenchmarkProject と BenchmarkStateMachine の定義に encryptionKey、logs、tracingEnabled がないことを確認した。",
      "timestamp": "2026-05-02T05:54:27Z"
    }
  ],
  "reproduction": {
    "reproducible": "unknown",
    "steps": [
      "cd memorag-bedrock-mvp",
      "task cdk:synth:yaml"
    ],
    "minimal_case": "BenchmarkProject と BenchmarkStateMachine を含む CDK stack を cdk-nag AwsSolutionsChecks 有効状態で synth する。",
    "repro_result": "修正後の task memorag:cdk:synth:yaml は成功し、対象 cdk-nag error は再発しなかった。AwsSolutions-SF2 は X-Ray tracing を無効にしたまま理由付き suppression で扱った。"
  },
  "validation": {
    "checks_performed": [
      "実装前の対象 resource と既存 infra test の静的確認",
      "task memorag:cdk:test",
      "task memorag:cdk:synth:yaml"
    ],
    "checks_failed": [],
    "checks_not_performed": [],
    "known_uncertainties": [
      "AwsSolutions-COG2 warning は既存の Cognito MFA 方針に関する警告として残存"
    ]
  },
  "suspected_root_cause": {
    "category": "infra_observability_and_encryption_gap",
    "description": "benchmark 実行基盤の CDK resource 追加時に、実行機能は接続されたが cdk-nag AwsSolutions の暗号化・監査・トレース要件が resource assertion に落とし込まれていなかった。",
    "confidence": "medium",
    "supporting_evidence": [
      "対象 CDK 定義に encryptionKey、logs、tracingEnabled が存在しない",
      "既存 infra test は CodeBuild Environment と Timeout、StateMachine DefinitionString のみを確認している"
    ]
  },
  "contributing_factors": [
    "cdk-nag が CI synth の最終ゲートになっている",
    "benchmark infra の追加範囲に運用監査設定の明示的テストが不足していた"
  ],
  "timeline": [
    {
      "timestamp": "2026-05-02T05:54:27Z",
      "event": "ユーザーが cdk-nag error と修正依頼を提示"
    },
    {
      "timestamp": "2026-05-02T05:54:27Z",
      "event": "対象 resource と既存テストを確認し、障害レポートを作成"
    },
    {
      "timestamp": "2026-05-02T06:00:00Z",
      "event": "CodeBuild KMS key と Step Functions ALL logging を追加し、X-Ray tracing はコスト抑制のため suppression 方針へ変更"
    },
    {
      "timestamp": "2026-05-02T06:05:00Z",
      "event": "infra test と cdk-nag synth が成功し、対象 error の解消を確認"
    }
  ],
  "actions_taken": [
    "worktree を作成した",
    "対象 CDK resource と既存 infra test を確認した",
    "なぜなぜ分析を障害レポートに記録した",
    "BenchmarkProject に customer managed KMS key を追加した",
    "BenchmarkStateMachine に CloudWatch Logs ALL logging を追加した",
    "X-Ray tracing はコスト抑制のため無効のまま AwsSolutions-SF2 suppression を追加した",
    "infra test の assertion と snapshot を更新した",
    "task memorag:cdk:test と task memorag:cdk:synth:yaml を実行した"
  ],
  "workaround": {
    "available": false,
    "description": "AwsSolutions-CB4 と AwsSolutions-SF1 は resource 設定を修正し、AwsSolutions-SF2 はコスト抑制のため理由付き suppression とする方針。",
    "limitations": []
  },
  "corrective_actions": [
    {
      "owner": "assistant",
      "action": "CodeBuild project に KMS encryption key を追加する",
      "due": "2026-05-02",
      "status": "done"
    },
    {
      "owner": "assistant",
      "action": "Step Functions に ALL logging を追加し、X-Ray tracing はコスト抑制のため suppression する",
      "due": "2026-05-02",
      "status": "done"
    },
    {
      "owner": "assistant",
      "action": "infra test と snapshot を更新して検証する",
      "due": "2026-05-02",
      "status": "done"
    }
  ],
  "prevention": {
    "recommended_changes": [
      "CDK resource 追加時は cdk-nag で求められる暗号化・監査・トレース設定を assertion に含める",
      "CI と同等の CDK synth をローカル検証に含める"
    ],
    "tests_to_add": [
      "CodeBuild Project の EncryptionKey assertion",
      "StepFunctions StateMachine の LoggingConfiguration assertion",
      "StepFunctions StateMachine で TracingConfiguration が出力されないことの assertion"
    ],
    "process_changes": [
      "benchmark infra 変更時の完了条件に cdk-nag synth 成功を含める"
    ]
  },
  "open_questions": [],
  "related_reports": [],
  "redactions": [],
  "confidence": "high",
  "tags": [
    "cdk-nag",
    "codebuild",
    "stepfunctions",
    "benchmark",
    "infra"
  ]
}
```
