# ADR-0007: 同期チャットの debug trace target を `chat_orchestration_run` に固定する

- ファイル: `docs/2_アーキテクチャ_ARC/21_重要決定_ADR/ARC_ADR_007.md`
- 種別: `ARC_ADR`
- 作成日: 2026-07-17
- 状態: Accepted

## Context

FR-049 は、チャット内の検索、回答生成、回答不能判定、tool 実行を `ChatOrchestrationRun` という同期処理として扱い、非同期エージェント実行と区別することを要求する。

current main の debug trace contract は `rag_run` と `chat_orchestration_run` の両方を列挙する一方、同期チャットの親 trace と standalone search の子 trace をともに `rag_run` として永続化していた。そのため、利用者が開始した同期チャット処理と内部検索処理を `targetType` だけで区別できず、要求、producer、fixture の語彙も一致していなかった。

既存 persisted trace には targetType 欠落、明示的 `rag_run` の双方があり、chat 親 trace と standalone search trace を確実に区別する migration marker はない。

## Decision

新規 trace の分類を次に固定する。

| trace | canonical `targetType` | 根拠 |
| --- | --- | --- |
| `/chat` または `/chat-runs` が生成する同期チャット親 trace | `chat_orchestration_run` | FR-049 の `ChatOrchestrationRun` と一致し、検索、回答生成、回答不能、tool invocation を一つの同期 run として表す。 |
| standalone search およびチャット親 trace が参照する検索子 trace | `rag_run` | 回答オーケストレーション全体ではなく、認可済み検索の replay / retrieval evidence を表す。 |
| ingest trace | `ingest_run` | 既存 contract を維持する。 |
| 非同期 agent trace | `async_agent_run` | 同期チャットと分離する。 |
| tool invocation trace | `tool_invocation` | tool 単位の監査対象を表す。 |

`DebugTraceTargetType`、API schema、shared contract は同じ列挙を持つ。同期チャット producer は `chat_orchestration_run` を直接指定し、generic schema の default に依存しない。

### Legacy read contract

- targetType がない v1 trace は、既存 contract と同じ bounded default `rag_run` として読む。
- targetType が明示された v1 trace は値を保持する。
- runId prefix、step label、answer の有無から既存 item を推測再分類しない。
- 一括 rewrite は行わず、新規 write から canonical value へ収束させる。

この方針は、standalone search を過去の chat 親 trace と誤認する migration を避ける。将来、authoritative migration marker を追加する場合は schema version と rollback 手順を別 decision で定義する。

## Options

| 選択肢 | 評価 |
| --- | --- |
| 同期チャット親 trace も `rag_run` に統一する | 不採用。RAG は実装方式であり、FR-049 が管理対象とする検索・回答・tool・refusal を含む同期 run の境界を表せない。standalone search とも区別できない。 |
| 同期チャット親 trace を `chat_orchestration_run`、検索子 trace を `rag_run` にする | 採用。要求の domain boundary と persisted trace の親子関係が一致する。 |
| 既存 `rag_run` を runId / step から自動再分類する | 不採用。authoritative marker がなく、誤分類による監査 evidence の改変になる。 |
| v2 schema へ一括移行する | 不採用。scalar classification 修正に対して migration / rollback の負荷が大きく、v1 の bounded read で安全に前方収束できる。 |

## Consequences

### Positive

- FR-049、runtime producer、store、API/shared contract、fixture の語彙が一致する。
- operator は同期チャット親 trace と検索子 trace を targetType で区別できる。
- `ChatToolInvocation.orchestrationRunId` と親 trace の run boundary を同じ domain 語彙で説明できる。
- 未根拠の legacy migration を追加しない。

### Negative

- legacy explicit `rag_run` chat trace は `rag_run` のまま残り、新旧 item が read 結果で混在する。
- `rag_run` だけを chat trace とみなしていた consumer は `chat_orchestration_run` を扱う必要がある。
- open PR が同じ schema / producer / generated docs を変更する場合、取り込み順に generator と contract test の再実行が必要になる。

## Security and data boundaries

- `targetType` は分類 metadata であり、認証・認可の根拠にしない。
- debug API の `chat:admin:read_all` gate、authoritative tenant prefix、actor/tenant partition、current permission reauthorization を変更しない。
- persistence / view / download は従来の diagnostic allowlist と redaction を再適用する。
- unauthorized / permission-revoked 経路では親 trace を残さず、targetType の変更で可視化範囲を広げない。

## Diagram policy

本 ADR は scalar vocabulary と legacy default の対応を決めるもので、component topology や時系列を変更しない。対応表の方が関係を過不足なく表すため Mermaid diagram は追加しない。

## Related requirements and design

- `FR-049`: チャット内オーケストレーション
- `FR-088`: debug trace の最小化・redaction
- `FR-090`: worker / orchestration の current authorization
- `DES_API_002`: DebugTraceV1 contract

## Rollback

新規 producer の targetType を以前の `rag_run` へ戻し、shared/API contract の列挙は後方互換のため維持できる。persisted object の rewrite は行わないため、rollback でデータ復元作業は不要である。
