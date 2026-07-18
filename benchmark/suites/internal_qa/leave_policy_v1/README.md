# 社内QA: 休暇制度 v1

休暇制度に関する RAG 回答、citation、answer unavailable を評価する sample benchmark suite です。

## 実行

```bash
./init.sh --env dev --reset-corpus --out ../../../../artifacts/benchmarks/leave_policy_v1/init/2026-05-21.001

../../../../benchmark/_shared/scripts/validate-suite.sh \
  --suite-dir .
```

`init.sh` は suite 固有処理を持たず、共通 `benchmark/_shared/scripts/init-suite.sh` に委譲します。
