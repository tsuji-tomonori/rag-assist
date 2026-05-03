# 追加実装計画レポート

保存先: `reports/working/20260503-1146-advanced-rag-ops-plan.md`

## 1. 受けた指示

- alias 管理 UI を実装する。
- Textract や高度な PDF/DOCX 構造抽出を実装する。
- table / list / code / figure 専用 chunk 正規化を実装する。
- full reindex migration / blue-green index switch を実装する。
- 作業を途中で止めず、検証、commit、push、PR 更新まで行う。

## 2. Done 条件

| ID | Done 条件 | 検証 |
|---|---|---|
| D1 | Web 管理画面から alias 作成、review、publish、audit 確認ができる | web typecheck / build |
| D2 | API の alias 管理 endpoint が UI 利用に必要な contract を満たす | API contract / security policy test |
| D3 | PDF は Textract 形式 JSON を扱える parser hook を持ち、page/heading/table/figure/code/list metadata を chunk に渡せる | API unit test |
| D4 | DOCX は mammoth raw text に加えて段落 style 由来の heading / list / table 正規化 hook を持つ | API unit test |
| D5 | table/list/code/figure chunk を normalized text と kind metadata 付きで生成する | text-processing test |
| D6 | reindex は staging index を作成し、cutover/rollback できる blue-green migration ledger を持つ | service/API test |
| D7 | docs、作業レポート、completion status、PR 本文が実装内容と検証結果に一致する | git diff --check / verify |

## 3. Milestones

| Milestone | 内容 | 予定 commit |
|---|---|---|
| M4 | alias 管理 UI | `feat(web)` |
| M5 | advanced extraction + chunk normalization | `feat(rag)` |
| M6 | blue-green reindex migration | `feat(api)` |
| M7 | docs / reports / PR update | `docs` or final commit |

## 4. 判断

- Textract 実 AWS 呼び出しは追加設定・権限・非同期 job が必要なため、MVP では Textract JSON / blocks を ingestion input として受ける parser hook を先に実装する。
- DOCX 高度抽出は `mammoth` の transform / style 情報を活用し、既存 raw text fallback を壊さない。
- alias UI は既存 admin workspace に統合し、新しい landing page は作らない。
- blue-green は既存 manifest/vector store に破壊的変更を入れず、migration ledger と staged document cutover / rollback で実現する。
