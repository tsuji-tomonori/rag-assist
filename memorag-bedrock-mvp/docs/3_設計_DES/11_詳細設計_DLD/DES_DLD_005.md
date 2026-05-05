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

通常の `/chat` は API サーバー時刻から `today` を生成する。server path の `nowIso` は UTC ISO とし、`today` は `timezone` に基づくローカル日付とする。質問文に「2026年5月1日時点」のような明示基準日がある場合は `source: "question"` として扱う。benchmark / test では内部 `ChatInput.asOfDate` から `source: "benchmark"` または `source: "test"` として固定基準日を注入できる。`asOfDate` が不正な日付の場合は server date へ silent fallback せず、`answerability.reason: "invalid_temporal_context"` として graph を即時拒否終了する。

### ToolIntent

```ts
type ToolIntent = {
  needsSearch: boolean;
  canAnswerFromQuestionOnly: boolean;
  needsArithmeticCalculation: boolean;
  needsAggregation: boolean;
  needsTemporalCalculation: boolean;
  needsTaskDeadlineIndex: boolean;
  needsExhaustiveEnumeration: boolean;
  temporalOperation?: "current_date" | "days_until" | "deadline_status" | "add_days" | "recurring_deadline" | "business_day_calculation";
  arithmeticOperation?: "sum" | "difference" | "percentage" | "price" | "average";
  confidence: number;
  reason: string;
};
```

MVP では deterministic rule で intent を判定する。将来 LLM 判定を追加する場合も、LLM 出力は intent 提案に限定し、tool 実行は Orchestrator が確定する。

明示日付を含んでいても、`ですか`、`合っていますか`、`資料`、`規程`、`文書`、`マニュアル` などの文書確認語彙を含む質問は question-only 計算にしない。たとえば「経費精算の期限は2026-05-10ですか？」は RAG retrieval に流し、質問文中の日付を根拠事実として採用しない。

相対期限ルールも同様に、文書確認語彙を含む場合は question-only 計算にしない。たとえば「経費精算の期限は申請から30日以内ですか？」は RAG retrieval に流す。相対期限の DateCalculator 対象は、申請日・提出日などの基準日が質問中にある場合、または「期限日」「いつ」「あと何日」「計算」などの計算要求が明示される場合に限定する。

current date は「今日」「本日」「現在」「今」と `日付` / `何日` が同時に出る場合だけ question-only 計算にする。「この資料の日付を確認してください」「契約書の日付を教えて」のような資料内日付確認は RAG retrieval に流し、server date を回答しない。

### ComputedFact

`computedFacts` は文書 evidence と別種の system-derived evidence として扱う。日付、数値、資料内の金額閾値条件との比較結果、未対応理由、構造化インデックス未実装理由を同じ配列に格納する。

## 処理手順

1. `analyze_input` の後に `build_temporal_context` を実行する。
2. `build_temporal_context` が invalid `asOfDate` を検出した場合は、retrieval へ進まず `finalize_refusal` で終了する。
3. `detect_tool_intent` で検索、日付計算、数値計算、全件列挙の要否を判定する。
4. `canAnswerFromQuestionOnly=true` の明示計算は先に `execute_computation_tools` に進む。
5. `execute_computation_tools` が usable `computedFacts` を返せない場合は、通常の RAG retrieval path へフォールバックする。
6. `DateCalculator` は `today` と `dueDate` の calendar day 差分で `daysRemaining`、`overdueDays`、`status` を確定する。
7. `Calculator` は明示された金額、人数、期間の MVP 乗算を deterministic に計算する。calendar date の年・月は期間 multiplier として扱わない。
8. 資料内の「1万円以上なら領収書が必要」のような金額閾値条件と質問中の金額を比較できる場合は、retrieval 後に `threshold_comparison` として確定する。
9. `generate_answer` には `temporalContext` と `computedFacts` を渡し、LLM は計算を再実行せず自然文化だけを担当する。
10. `validate_citations` は document citation がなくても `usedComputedFactIds` が有効なら strict grounded として扱う。
11. `verify_answer_support` は document chunk と computed fact の両方を回答根拠として検証する。

## DateCalculator ルール

| 条件 | 判定 |
|---|---|
| `dueDate > today` | `not_due`、残日数を返す |
| `dueDate === today` | `due_today`、期限切れではない |
| `dueDate < today` | `overdue`、超過日数を返す |

MVP の単位は `calendar_day` のみとする。`business_day`、繰り返し期限、会社休日は未対応理由を `calculation_unavailable` として返す。

`days_until` で `dueDate < today` になる場合は負の残日数を返さず、`deadline_status` に寄せて超過日数を返す。

`営業日` を含むだけの文書質問は compute-only にしない。`5営業日以内`、`何営業日後`、`営業日を加算`、`あと何営業日`、`期限切れ` のように営業日計算を明示する場合だけ `business_day` 未対応として扱う。

`期限`、`締切`、`まで` を含むだけでは日付計算 intent としない。`あと何日`、`残り何日`、`まで何日`、`何日後`、`日数`、`期限切れ`、`超過`、`本日期限` など、日数計算または期限状態判定を明示する語彙がある場合だけ DateCalculator 対象にする。

## エラー・未対応処理

| ケース | 方針 |
|---|---|
| 申請から30日以内だが申請日がない | `calculation_unavailable` に `missingInputs` を入れる |
| 5営業日以内 | `business_day` 未対応として回答に明示する |
| 文書に書かれた営業日期限を聞く質問 | 通常の RAG retrieval に流す |
| 明示日付を含む文書確認質問 | 質問文の日付を計算入力にせず、通常の RAG retrieval に流す |
| 相対期限ルールを含む文書確認質問 | 質問文の相対期限ルールを計算入力にせず、通常の RAG retrieval に流す |
| 資料内の日付確認質問 | current date とせず、通常の RAG retrieval に流す |
| 資料内の金額閾値条件への該当可否 | RAG retrieval 後に文書条件と質問金額を `threshold_comparison` として比較する |
| 期限切れタスクの全件一覧 | `TaskDeadlineIndex` 未実装として完全一覧不可を明示する |
| 計算 intent の false positive | usable `computedFacts` がなければ RAG retrieval へフォールバックする |
| 不正な `asOfDate` | `invalid_temporal_context` として retrieval 前に拒否する |
| 文書根拠が必要な質問 | 通常の RAG retrieval と answerability gate に委ねる |

`calculation_unavailable` は `answerability.reason: "calculation_unavailable"`、`TaskDeadlineIndex` 未実装は `answerability.reason: "structured_index_unavailable"` として、通常の `sufficient_evidence` と区別する。

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
| 今日の日付への回答 | `computation.test.ts`, `graph.test.ts` |
| `asOfDate` 注入時の `source: test` | `computation.test.ts`, `graph.test.ts` |
| 不正な `asOfDate` の fail-fast | `computation.test.ts`, `graph.test.ts` |
| 営業日を含む RAG 質問の retrieval route | `graph.test.ts` |
| 明示日付を含む文書確認質問の retrieval route | `computation.test.ts`, `graph.test.ts` |
| 相対期限ルールを含む文書確認質問の retrieval route | `computation.test.ts`, `graph.test.ts` |
| 資料内日付確認質問の retrieval route | `computation.test.ts`, `graph.test.ts` |
| 計算 intent false positive の RAG fallback | `graph.test.ts` |
| calendar date の年・月を期間 multiplier にしない | `computation.test.ts` |
| 文書根拠つき金額閾値比較 | `computation.test.ts`, `graph.test.ts` |
| computedFacts の debug trace 出力 | `graph.test.ts` |
| computed fact による support verifier | `graph.test.ts` |
