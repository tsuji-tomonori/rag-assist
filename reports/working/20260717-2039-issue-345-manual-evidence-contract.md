# Issue #345 manual a11y evidence contract 作業レポート

## 受けた指示

- Issue #345 の残作業を、完了条件を満たす bounded unit ごとに実装・検証し、Draft PR と Issue 進捗まで進める。
- 実施していない screen reader、browser zoom、real-device の manual evidence を成功扱いしない。
- merge、deploy、release は行わない。

## 要件整理

- `NFR-018` と既存 manual evidence task が要求する environment、date、persona、journey、input、result、evidence、defect/task を versioned record で表現する。
- manual `pass` と automation/proxy evidence を分離し、実測 metadata と manual evidence がない pass を拒否する。
- `blocked` / `not_run` は構造上保存可能にするが、release / Issue completion readiness では必ず非 pass とする。
- 未承認の `OQ-UI-002` matrix、owner、cadence は架空値で埋めない。

## 検討・判断

- 通常の docs/PR CI では honest blocked baseline の構造検証を必須化し、既知の未実施を隠さない。
- full completion 用 `require-pass` command を別にし、matrix 未承認または required check が pass 以外なら終了コード 2 とする。
- 既存 `NFR-018` の実装証跡を具体化する変更であり、新規要件は作成しない。spec-recovery 合成ファイルも不要と判断した。
- production UI/API、認証・認可、RAG runtime は変更していない。

## 実施作業・成果物

- canonical contract: `tools/web-inventory/manual-a11y-evidence-contract.json`
- validator/CLI: `tools/web-inventory/manual-a11y-evidence.mjs`
- positive/negative tests: `tools/web-inventory/manual-a11y-evidence.test.mjs`
- honest baseline: `reports/working/issue-345-manual-a11y-evidence-baseline.json`
- package/Taskfile commands と required CI structural check
- `NFR-018`、`DES_UI_UX_001`、manual evidence task、UI trace manifest/generated inventory の同期

## 検証結果

- `npm run docs:manual-a11y-evidence:test`: 7/7 pass。
- `npm run docs:manual-a11y-evidence:check`: pass。ただし `pass=0`、`blocked=3`、`not_run=1`、`ready=false`。
- `npm run docs:manual-a11y-evidence:require-pass`: 意図どおり終了コード 2。release / Issue completion readiness を拒否。
- `npm run lint -- --no-cache`: pass。
- `npm run lint`: pass。
- semantic UI、UI trace、inventory freshness、RAG release source audit: pass。
- `task docs:check`: `npm ci` 後の再実行で pass。初回は worktree に `node_modules` がなく `tsx` IPC が利用できず失敗した。
- `npm run ci`: pass。API/Web/infra/benchmark の test、typecheck、build を含む。
- `npm ci`: pass。lockfile 変更なし。既存 dependency audit は 8 件（low 2、moderate 1、high 5）を報告。
- E2E: production UI/runtime を変更していないため追加実行なし。manual 実測の代替にはしていない。

## 指示への fit 評価

- bounded unit の AC1-AC9 は満たした。
- blocked/not_run を構造上の成功から release-ready 成功へ昇格させない。
- manual evidence baseline に架空 environment、executor、result、artifact を記録していない。
- README、OpenAPI、API example、運用手順は product behavior/API/setup を変更しないため更新不要。

## 未対応・制約・リスク

- `OQ-UI-002` の matrix、cadence、owner は未承認・未割り当て。
- manual keyboard、representative screen reader、実 browser 200%/400% zoom、real-device は未実施。
- baseline は Issue #345 全体の completion/merge-ready evidence ではない。
- GitHub Apps connector は利用可能 tool に出ていないため、PR 操作は `gh` fallback とし、その制約を PR に明記する。
- Draft PR、GitHub CI、受け入れ条件/self-review comment、Issue 進捗、task done lifecycle は作業継続中。
- merge、deploy、release は行わない。
