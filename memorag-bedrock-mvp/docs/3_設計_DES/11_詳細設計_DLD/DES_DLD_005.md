# Temporal / Computation Layer 詳細設計

- ファイル: `memorag-bedrock-mvp/docs/3_設計_DES/11_詳細設計_DLD/DES_DLD_005.md`
- 種別: `DES_DLD`
- 作成日: 2026-05-04
- 状態: Draft

## 何を書く場所か

固定 RAG workflow に deterministic な日付計算・数値計算を組み込む詳細設計を書く。

## 対象

- `Query Orchestrator`
- `TemporalContextProvider`
- `ToolIntentDetector`
- `DateCalculator`
- `Calculator`
- `computedFacts`
- `Prompt Builder`
- `Citation Validator`
- `Answer Support Verifier`

## 入出力

### TemporalContext

```ts
type TemporalContext = {
  nowIso: string;
  today: string;
  timezone: string;
  source: "server" | "question" | "benchmark" | "test";
};
```

通常の `/chat` は API サーバー時刻から `today` を生成する。質問文に「2026年5月1日時点」のような明示基準日がある場合は `source: "question"` として扱う。

### ToolIntent

```ts
type ToolIntent = {
  needsSearch: boolean;
  needsArithmeticCalculation: boolean;
  needsAggregation: boolean;
  needsTemporalCalculation: boolean;
  needsTaskDeadlineIndex: boolean;
  needsExhaustiveEnumeration: boolean;
  temporalOperation?: "days_until" | "deadline_status" | "add_days" | "recurring_deadline";
  arithmeticOperation?: "sum" | "difference" | "percentage" | "price" | "average";
  confidence: number;
  reason: string;
};
```

MVP では deterministic rule で intent を判定する。将来 LLM 判定を追加する場合も、LLM 出力は intent 提案に限定し、tool 実行は Orchestrator が確定する。

### ComputedFact

`computedFacts` は文書 evidence と別種の system-derived evidence として扱う。日付、数値、未対応理由、構造化インデックス未実装理由を同じ配列に格納する。

## 処理手順

1. `analyze_input` の後に `build_temporal_context` を実行する。
2. `detect_tool_intent` で検索、日付計算、数値計算、全件列挙の要否を判定する。
3. `needsSearch=false` の明示計算は RAG retrieval を通さず `execute_computation_tools` に進む。
4. `DateCalculator` は `today` と `dueDate` の calendar day 差分で `daysRemaining`、`overdueDays`、`status` を確定する。
5. `Calculator` は明示された金額、人数、月数、年数の MVP 乗算を deterministic に計算する。
6. `generate_answer` には `temporalContext` と `computedFacts` を渡し、LLM は計算を再実行せず自然文化だけを担当する。
7. `validate_citations` は document citation がなくても `usedComputedFactIds` が有効なら strict grounded として扱う。
8. `verify_answer_support` は document chunk と computed fact の両方を回答根拠として検証する。

## DateCalculator ルール

| 条件 | 判定 |
|---|---|
| `dueDate > today` | `not_due`、残日数を返す |
| `dueDate === today` | `due_today`、期限切れではない |
| `dueDate < today` | `overdue`、超過日数を返す |

MVP の単位は `calendar_day` のみとする。`business_day`、繰り返し期限、会社休日は未対応理由を `calculation_unavailable` として返す。

## エラー・未対応処理

| ケース | 方針 |
|---|---|
| 申請から30日以内だが申請日がない | `calculation_unavailable` に `missingInputs` を入れる |
| 5営業日以内 | `business_day` 未対応として回答に明示する |
| 期限切れタスクの全件一覧 | `TaskDeadlineIndex` 未実装として完全一覧不可を明示する |
| 文書根拠が必要な質問 | 通常の RAG retrieval と answerability gate に委ねる |

## セキュリティ・アクセス制御

新規 route は追加しない。`/chat` の既存認可境界を維持する。将来 `TaskDeadlineIndex` を実装する場合は、tenant、ACL group、user scope を検索条件に必ず含める。

## テスト観点

| 観点 | 対応 |
|---|---|
| 2026-05-03 基準で 2026-05-10 はあと7日 | `computation.test.ts` |
| 本日期限は期限切れではない | `computation.test.ts` |
| 2026-05-01 期限は2日超過 | `computation.test.ts` |
| 申請から30日以内、申請日あり | `computation.test.ts` |
| 申請日不明 | `computation.test.ts` |
| 期限切れタスク全件一覧の未対応明示 | `computation.test.ts` |
| computedFacts の debug trace 出力 | `graph.test.ts` |
| computed fact による support verifier | `graph.test.ts` |
