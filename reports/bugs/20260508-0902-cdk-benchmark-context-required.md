# CDK benchmark source context required failure

## 障害レポート

**保存先:** `reports/bugs/20260508-0902-cdk-benchmark-context-required.md`
**概要:** GitHub Actions の deploy workflow で CloudFormation YAML synth を実行した際、CDK stack が `benchmarkSourceOwner` context を必須として扱い、context 未指定のため例外終了した。
**重大度:** `S1_high`
**状態:** `resolved`
**影響:** deploy workflow の synth 以降が進まず、CDK artifact 作成と deploy がブロックされた。
**原因仮説:** Benchmark runner の CodeBuild GitHub source context を必須化した一方で、deploy workflow の bootstrap/synth/deploy コマンドにはその context が渡されていなかった。PR CI と infra test は context を明示していたため検出できなかった。
**現在の対応:** CDK stack に benchmark source の既定値を追加し、deploy workflow でも bootstrap/synth/deploy の各 CDK コマンドへ context を明示した。context 省略時と上書き時の infra test を追加した。
**次のアクション:** PR CI で workflow と infra test の再確認を行う。

## なぜなぜ分析

| Why | 質問 | 回答 | 根拠 |
|---:|---|---|---|
| 1 | なぜ workflow が失敗したか | `MemoRagMvpStack` 初期化時に `benchmarkSourceOwner` が未指定で例外を投げたため。 | エラーログと `memorag-mvp-stack.ts` の `requireContext("benchmarkSourceOwner")` |
| 2 | なぜ `benchmarkSourceOwner` が未指定だったか | `.github/workflows/memorag-deploy.yml` の synth/bootstrap/deploy が model/env context だけを渡していたため。 | deploy workflow の CDK command |
| 3 | なぜ PR CI で検出されなかったか | `.github/workflows/memorag-ci.yml` と infra test helper は benchmark source context を明示していたため。 | CI workflow と `infra/test/memorag-mvp-stack.test.ts` |
| 4 | なぜ context 必須化が脆弱だったか | CodeBuild source にはリポジトリ既定値を定義できるにもかかわらず、stack 側に fallback がなかったため。 | `defaultResourceTags.Repository` は固定値を持つが benchmark source には既定値がなかった |
| 5 | なぜ再発し得るか | context ありのテストだけでは、context 省略時の CDK app 起動可否を保証できないため。 | 追加前のテストは省略ケースを直接検証していなかった |

## 修正内容

- `memorag-bedrock-mvp/infra/lib/memorag-mvp-stack.ts` に benchmark source の既定値を追加した。
- `.github/workflows/memorag-deploy.yml` の CDK bootstrap/synth/deploy に benchmark source context を明示した。
- `memorag-bedrock-mvp/infra/test/memorag-mvp-stack.test.ts` に context 省略時の既定値と明示 context の上書きテストを追加した。
- `memorag-bedrock-mvp/docs/GITHUB_ACTIONS_DEPLOY.md` に既定値と workflow の明示 context 方針を記載した。

## 検証

- `npm ci`: pass
- `npm run cdk -w @memorag-mvp/infra -- synth`: fail を再現。`CDK context "benchmarkSourceOwner" is required.`
- `task memorag:cdk:synth:yaml`: 修正後 pass
- `task memorag:cdk:test`: 修正後 pass
- `git diff --check`: pass

```json failure_report
{
  "schema_version": "1.0.0",
  "report_id": "FR-20260508-090200-CDKBENCHCTX",
  "created_at": "2026-05-08T09:02:00+09:00",
  "incident_type": "runtime_error",
  "failure_mode": "missing_required_field",
  "severity": "S1_high",
  "status": "resolved",
  "summary": "CDK synth failed because benchmarkSourceOwner was required but not provided by the deploy workflow.",
  "user_request": "障害レポートを作成したうえでなぜなぜ分析を行い修正して",
  "expected": "CDK bootstrap, synth, and deploy commands should run with a valid benchmark CodeBuild source configuration.",
  "actual": "CDK app initialization threw Error: CDK context \"benchmarkSourceOwner\" is required.",
  "impact": {
    "user": "GitHub Actions deploy workflow could not create CDK synth artifacts or proceed to deploy.",
    "artifacts": [
      "memorag-bedrock-mvp/infra/cdk.out/MemoRagMvpStack.template.yaml"
    ],
    "scope": "memorag-bedrock-mvp infra deployment workflow"
  },
  "evidence": [
    {
      "type": "error_log",
      "detail": "Error: CDK context \"benchmarkSourceOwner\" is required."
    },
    {
      "type": "file",
      "path": "memorag-bedrock-mvp/infra/lib/memorag-mvp-stack.ts",
      "detail": "The stack required benchmarkSourceOwner, benchmarkSourceRepo, and benchmarkSourceBranch through context."
    },
    {
      "type": "file",
      "path": ".github/workflows/memorag-deploy.yml",
      "detail": "The deploy workflow CDK commands did not provide benchmark source context before the fix."
    }
  ],
  "suspected_root_cause": "Benchmark source context was made mandatory in the CDK stack, but the deploy workflow was not updated to pass those context keys and tests did not cover the omitted-context path.",
  "actions_taken": [
    {
      "action": "Reproduced the failure locally with npm run cdk -w @memorag-mvp/infra -- synth.",
      "status": "done"
    },
    {
      "action": "Added default benchmark source values in the CDK stack.",
      "status": "done"
    },
    {
      "action": "Added benchmark source context to deploy workflow CDK commands.",
      "status": "done"
    },
    {
      "action": "Added infra tests for omitted and overridden benchmark source context.",
      "status": "done"
    }
  ],
  "corrective_actions": [
    {
      "owner": "codex",
      "action": "Keep a test that synthesizes the stack without benchmark source context.",
      "due": "2026-05-08",
      "status": "done"
    },
    {
      "owner": "codex",
      "action": "Document default benchmark source behavior.",
      "due": "2026-05-08",
      "status": "done"
    }
  ],
  "open_questions": [],
  "confidence": "high",
  "tags": [
    "cdk",
    "github-actions",
    "memorag-bedrock-mvp",
    "benchmark"
  ],
  "environment": {
    "repository": "rag-assist",
    "workflow": ".github/workflows/memorag-deploy.yml",
    "date": "2026-05-08"
  },
  "affected_artifacts": [
    ".github/workflows/memorag-deploy.yml",
    "memorag-bedrock-mvp/infra/lib/memorag-mvp-stack.ts",
    "memorag-bedrock-mvp/infra/test/memorag-mvp-stack.test.ts",
    "memorag-bedrock-mvp/docs/GITHUB_ACTIONS_DEPLOY.md"
  ],
  "reproduction": {
    "command": "npm run cdk -w @memorag-mvp/infra -- synth",
    "result": "failed before the fix with missing benchmarkSourceOwner context"
  },
  "validation": [
    {
      "command": "task memorag:cdk:synth:yaml",
      "result": "pass"
    },
    {
      "command": "task memorag:cdk:test",
      "result": "pass"
    },
    {
      "command": "git diff --check",
      "result": "pass"
    }
  ],
  "timeline": [
    {
      "time": "2026-05-08T09:02:00+09:00",
      "event": "Task started and failure reproduced locally."
    },
    {
      "time": "2026-05-08T09:02:00+09:00",
      "event": "CDK stack, deploy workflow, tests, and docs were updated."
    }
  ],
  "prevention": [
    "Maintain omitted-context CDK synth coverage.",
    "Keep workflow CDK context keys aligned with stack context usage."
  ],
  "related_reports": [],
  "redactions": []
}
```
